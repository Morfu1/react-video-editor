import { Project, MediaFile, StorageCapabilities } from '@/types/project';
import { FileSystemService } from './fileSystemService';
import { IndexedDBService } from './indexedDBService';
import { DriveStorageService } from './driveStorageService';
import { serverStorageService } from './serverStorageService';
import { detectStorageCapabilities } from '@/utils/capabilities';

export type StorageLocation = 'local' | 'drive' | 'both';

export class HybridStorageService {
  private fileSystemService: FileSystemService;
  private indexedDBService: IndexedDBService;
  private driveService: DriveStorageService;
  private capabilities: StorageCapabilities;
  private isInitialized = false;

  constructor() {
    this.fileSystemService = new FileSystemService();
    this.indexedDBService = new IndexedDBService();
    this.driveService = new DriveStorageService();
    this.capabilities = detectStorageCapabilities();
  }

  /**
   * Initialize storage services
   */
  async init(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Always initialize IndexedDB as fallback
      await this.indexedDBService.init();
      
      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize storage services:', error);
      throw new Error('Failed to initialize storage');
    }
  }

  /**
   * Save project to specified location(s)
   */
  async saveProject(project: Project, location: StorageLocation = 'local'): Promise<Project> {
    if (!this.isInitialized) await this.init();

    const updatedProject = {
      ...project,
      updatedAt: new Date().toISOString(),
      storage: {
        ...project.storage,
        location,
      },
    };

    try {
      switch (location) {
        case 'local':
          await this.saveProjectLocally(updatedProject);
          break;
        case 'drive':
          await this.saveProjectToDrive(updatedProject);
          break;
        case 'both':
          await Promise.all([
            this.saveProjectLocally(updatedProject),
            this.saveProjectToDrive(updatedProject),
          ]);
          break;
      }

      return updatedProject;
    } catch (error) {
      console.error('Error saving project:', error);
      throw new Error(`Failed to save project to ${location}`);
    }
  }

  /**
   * Load project from storage
   */
  async loadProject(projectId: string, preferredLocation?: StorageLocation): Promise<Project | null> {
    if (!this.isInitialized) await this.init();

    console.log('HybridStorageService.loadProject called for:', projectId, 'preferredLocation:', preferredLocation);

    // Try preferred location first, then fallback
    const locations: StorageLocation[] = preferredLocation 
      ? ([preferredLocation, 'local', 'drive'] as StorageLocation[]).filter((loc, index, arr) => arr.indexOf(loc) === index)
      : (['local', 'drive'] as StorageLocation[]);

    console.log('Trying locations:', locations);

    for (const location of locations) {
      try {
        console.log(`Attempting to load from ${location}...`);
        const project = await this.loadProjectFromLocation(projectId, location);
        if (project) {
          console.log(`Successfully loaded project from ${location}:`, project.id);
          return project;
        } else {
          console.log(`No project found in ${location}`);
        }
      } catch (error) {
        console.warn(`Failed to load project from ${location}:`, error);
      }
    }

    console.log('Project not found in any location');
    return null;
  }

  /**
   * List all projects from all available storage locations
   */
  async listProjects(): Promise<Project[]> {
    if (!this.isInitialized) await this.init();

    const projects = new Map<string, Project>();

    try {
      // Get local projects
      const localProjects = await this.listLocalProjects();
      localProjects.forEach(project => {
        projects.set(project.id, project);
      });

      // Get Drive projects (if authenticated)
      try {
        const driveProjects = await this.listDriveProjects();
        driveProjects.forEach(project => {
          const existing = projects.get(project.id);
          if (!existing || new Date(project.updatedAt) > new Date(existing.updatedAt)) {
            projects.set(project.id, project);
          }
        });
      } catch (error) {
        console.warn('Failed to list Drive projects:', error);
      }
    } catch (error) {
      console.error('Error listing projects:', error);
    }

    return Array.from(projects.values()).sort((a, b) => 
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  /**
   * Save media file
   */
  async saveMediaFile(
    projectId: string, 
    file: File, 
    location: StorageLocation = 'local',
    onProgress?: (progress: number) => void
  ): Promise<MediaFile> {
    if (!this.isInitialized) await this.init();

    try {
      switch (location) {
        case 'local':
          return await this.saveMediaFileLocally(projectId, file);
        case 'drive':
          return await this.saveMediaFileToDrive(projectId, file, onProgress);
        case 'both':
          const [localFile, driveFile] = await Promise.all([
            this.saveMediaFileLocally(projectId, file),
            this.saveMediaFileToDrive(projectId, file, onProgress),
          ]);
          return {
            ...localFile,
            driveFileId: driveFile.driveFileId,
          };
        default:
          throw new Error(`Invalid storage location: ${location}`);
      }
    } catch (error) {
      console.error('Error saving media file:', error);
      throw new Error(`Failed to save media file to ${location}`);
    }
  }

  /**
   * Get media files for a project
   */
  async getProjectMediaFiles(projectId: string): Promise<MediaFile[]> {
    if (!this.isInitialized) await this.init();

    try {
      // Try to get from local storage first
      const localFiles = await this.getLocalMediaFiles(projectId);
      if (localFiles.length > 0) {
        // Filter out invalid blob URLs that don't persist across sessions
        const validFiles = localFiles.filter(file => {
          // Keep only files with server URLs (http/https) that persist across sessions
          return file.url && (
            file.url.startsWith('http') || 
            file.url.startsWith('https')
          );
        });
        
        // If we filtered out broken files, update the project
        if (validFiles.length !== localFiles.length) {
          console.log(`Filtered out ${localFiles.length - validFiles.length} invalid media files`);
          await this.cleanupInvalidMediaFiles(projectId, validFiles);
        }
        
        return validFiles;
      }

      // Fallback to Drive if available
      return await this.getDriveMediaFiles(projectId);
    } catch (error) {
      console.error('Error getting media files:', error);
      return [];
    }
  }

  /**
   * Sync project between local and drive storage
   */
  async syncProject(projectId: string): Promise<Project | null> {
    if (!this.isInitialized) await this.init();

    try {
      const [localProject, driveProject] = await Promise.all([
        this.loadProjectFromLocation(projectId, 'local').catch(() => null),
        this.loadProjectFromLocation(projectId, 'drive').catch(() => null),
      ]);

      if (!localProject && !driveProject) {
        return null;
      }

      // Determine which version is newer
      let newerProject: Project;
      if (!localProject) {
        newerProject = driveProject!;
        await this.saveProjectLocally(newerProject);
      } else if (!driveProject) {
        newerProject = localProject;
        await this.saveProjectToDrive(newerProject);
      } else {
        const localTime = new Date(localProject.updatedAt).getTime();
        const driveTime = new Date(driveProject.updatedAt).getTime();
        
        if (localTime > driveTime) {
          newerProject = localProject;
          await this.saveProjectToDrive(newerProject);
        } else {
          newerProject = driveProject;
          await this.saveProjectLocally(newerProject);
        }
      }

      return {
        ...newerProject,
        storage: {
          ...newerProject.storage,
          location: 'both',
          lastSync: new Date().toISOString(),
        },
      };
    } catch (error) {
      console.error('Error syncing project:', error);
      throw new Error('Failed to sync project');
    }
  }

  /**
   * Delete project from specified location(s)
   */
  async deleteProject(projectId: string, location: StorageLocation = 'both'): Promise<void> {
    if (!this.isInitialized) await this.init();

    const errors: string[] = [];

    if (location === 'local' || location === 'both') {
      try {
        await this.deleteProjectLocally(projectId);
      } catch (error) {
        errors.push(`Local: ${error.message}`);
      }
    }

    if (location === 'drive' || location === 'both') {
      try {
        await this.deleteProjectFromDrive(projectId);
      } catch (error) {
        errors.push(`Drive: ${error.message}`);
      }
    }

    if (errors.length > 0) {
      throw new Error(`Failed to delete project: ${errors.join(', ')}`);
    }
  }

  // Private helper methods
  private async saveProjectLocally(project: Project): Promise<void> {
    if (this.capabilities.fileSystemAccess) {
      await this.fileSystemService.saveProjectMetadata(project);
    } else {
      await this.indexedDBService.saveProject(project);
    }
    
    project.storage.localPath = `local://${project.name}`;
  }

  private async saveProjectToDrive(project: Project): Promise<void> {
    let folderId = project.storage.driveFileId;
    
    if (!folderId) {
      folderId = await this.driveService.createProjectFolder(project.name);
    }
    
    await this.driveService.uploadProjectMetadata(project, folderId);
    project.storage.driveFileId = folderId;
  }

  private async loadProjectFromLocation(projectId: string, location: StorageLocation): Promise<Project | null> {
    console.log(`loadProjectFromLocation: ${location}, fileSystemAccess: ${this.capabilities.fileSystemAccess}`);
    
    switch (location) {
      case 'local':
        if (this.capabilities.fileSystemAccess) {
          // Implementation depends on how you map projectId to project name
          // This is a simplified version
          console.log('FileSystemAccess is available but not implemented, returning null');
          return null; // You'd need to implement project name lookup
        } else {
          console.log('Using IndexedDB to load project');
          const project = await this.indexedDBService.loadProject(projectId);
          console.log('IndexedDB loadProject result:', project?.id);
          return project;
        }
      case 'drive':
        console.log('Attempting to load from Google Drive');
        return await this.driveService.downloadProjectMetadata(projectId);
      default:
        console.log('Unknown location:', location);
        return null;
    }
  }

  private async listLocalProjects(): Promise<Project[]> {
    if (this.capabilities.fileSystemAccess) {
      // Would need to implement project enumeration for FileSystem API
      return [];
    } else {
      return await this.indexedDBService.listProjects();
    }
  }

  private async listDriveProjects(): Promise<Project[]> {
    try {
      const folders = await this.driveService.listProjectFolders();
      const projects: Project[] = [];

      for (const folder of folders) {
        try {
          const project = await this.driveService.downloadProjectMetadata(folder.id);
          projects.push(project);
        } catch (error) {
          console.warn(`Failed to load project ${folder.name}:`, error);
        }
      }

      return projects;
    } catch (error) {
      console.warn('Failed to list drive projects:', error);
      return [];
    }
  }

  private async saveMediaFileLocally(projectId: string, file: File): Promise<MediaFile> {
    // Try server storage first (best for development persistence)
    try {
      const isServerAvailable = await serverStorageService.isServerAvailable();
      if (isServerAvailable) {
        console.log('Using server storage for media file');
        return await serverStorageService.uploadFile(file, projectId);
      }
    } catch (error) {
      console.warn('Server storage failed, falling back to local storage:', error);
    }

    // Fallback to local storage methods
    if (this.capabilities.fileSystemAccess) {
      return await this.fileSystemService.saveMediaFile(projectId, file);
    } else {
      return await this.indexedDBService.saveMediaFile(projectId, file);
    }
  }

  private async saveMediaFileToDrive(
    projectId: string, 
    file: File, 
    onProgress?: (progress: number) => void
  ): Promise<MediaFile> {
    // You'd need to get the project's Drive folder ID first
    const folderId = 'project-drive-folder-id'; // Implement this lookup
    const driveFileId = await this.driveService.uploadMediaFile(file, folderId, onProgress);
    
    return {
      id: crypto.randomUUID(),
      name: file.name,
      type: file.type.startsWith('video/') ? 'video' : file.type.startsWith('audio/') ? 'audio' : 'image',
      size: file.size,
      driveFileId,
      url: URL.createObjectURL(file), // Temporary URL
    };
  }

  private async getLocalMediaFiles(projectId: string): Promise<MediaFile[]> {
    // Try to get files from server storage first if available
    try {
      const isServerAvailable = await serverStorageService.isServerAvailable();
      if (isServerAvailable) {
        // For now, server storage doesn't have a listing endpoint, so fallback to local
        // We'll add this functionality later if needed
      }
    } catch (error) {
      console.warn('Server storage check failed:', error);
    }

    // Fallback to local storage methods
    if (this.capabilities.fileSystemAccess) {
      // Implement FileSystem media file listing
      return [];
    } else {
      return await this.indexedDBService.getProjectMediaFiles(projectId);
    }
  }

  private async getDriveMediaFiles(projectId: string): Promise<MediaFile[]> {
    // Implement Drive media file listing
    return [];
  }

  private async deleteProjectLocally(projectId: string): Promise<void> {
    if (this.capabilities.fileSystemAccess) {
      // Implement FileSystem project deletion
    } else {
      await this.indexedDBService.deleteProject(projectId);
    }
  }

  private async deleteProjectFromDrive(projectId: string): Promise<void> {
    // Implement Drive project deletion
    await this.driveService.deleteFile(projectId);
  }



  /**
   * Clean up invalid media files from project
   */
  private async cleanupInvalidMediaFiles(projectId: string, validFiles: MediaFile[]): Promise<void> {
    try {
      // Load the current project
      const project = await this.loadProject(projectId);
      if (project) {
        // Update project with only valid media files
        const updatedProject = {
          ...project,
          mediaFiles: validFiles,
          updatedAt: new Date().toISOString()
        };
        
        // Save the cleaned project back
        await this.saveProject(updatedProject);
        console.log(`Cleaned up invalid media files for project ${projectId}`);
      }
    } catch (error) {
      console.error('Error cleaning up invalid media files:', error);
    }
  }
}