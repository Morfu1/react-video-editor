import { Project, MediaFile } from '@/types/project';
import '@/types/file-system-api';

export class FileSystemService {
  private projectDirectory: FileSystemDirectoryHandle | null = null;

  /**
   * Request user to select a directory for projects
   */
  async selectProjectDirectory(): Promise<FileSystemDirectoryHandle> {
    try {
      this.projectDirectory = await window.showDirectoryPicker!({
        mode: 'readwrite',
        startIn: 'documents'
      });
      
      // Store reference in localStorage for next session
      localStorage.setItem('hasProjectDirectory', 'true');
      
      return this.projectDirectory;
    } catch (error) {
      console.error('Error selecting directory:', error);
      throw new Error('Failed to select project directory');
    }
  }

  /**
   * Create a new project directory
   */
  async createProjectDirectory(projectName: string): Promise<FileSystemDirectoryHandle> {
    if (!this.projectDirectory) {
      throw new Error('No project directory selected');
    }

    try {
      const projectDir = await this.projectDirectory.getDirectoryHandle(projectName, {
        create: true
      });
      
      // Create subdirectories
      await projectDir.getDirectoryHandle('media', { create: true });
      await projectDir.getDirectoryHandle('exports', { create: true });
      
      return projectDir;
    } catch (error) {
      console.error('Error creating project directory:', error);
      throw new Error('Failed to create project directory');
    }
  }

  /**
   * Save project metadata to JSON file
   */
  async saveProjectMetadata(project: Project): Promise<void> {
    if (!this.projectDirectory) {
      throw new Error('No project directory selected');
    }

    try {
      const projectDir = await this.projectDirectory.getDirectoryHandle(project.name, {
        create: true
      });
      
      const fileHandle = await projectDir.getFileHandle('project.json', {
        create: true
      });
      
      const writable = await fileHandle.createWritable();
      await writable.write(JSON.stringify(project, null, 2));
      await writable.close();
      
    } catch (error) {
      console.error('Error saving project metadata:', error);
      throw new Error('Failed to save project metadata');
    }
  }

  /**
   * Load project metadata from JSON file
   */
  async loadProjectMetadata(projectName: string): Promise<Project> {
    if (!this.projectDirectory) {
      throw new Error('No project directory selected');
    }

    try {
      const projectDir = await this.projectDirectory.getDirectoryHandle(projectName);
      const fileHandle = await projectDir.getFileHandle('project.json');
      const file = await fileHandle.getFile();
      const content = await file.text();
      
      return JSON.parse(content) as Project;
    } catch (error) {
      console.error('Error loading project metadata:', error);
      throw new Error('Failed to load project metadata');
    }
  }

  /**
   * Save media file to project directory
   */
  async saveMediaFile(projectName: string, file: File): Promise<MediaFile> {
    if (!this.projectDirectory) {
      throw new Error('No project directory selected');
    }

    try {
      const projectDir = await this.projectDirectory.getDirectoryHandle(projectName);
      const mediaDir = await projectDir.getDirectoryHandle('media');
      
      const fileHandle = await mediaDir.getFileHandle(file.name, {
        create: true
      });
      
      const writable = await fileHandle.createWritable();
      await writable.write(file);
      await writable.close();
      
      return {
        id: crypto.randomUUID(),
        name: file.name,
        type: this.getFileType(file.type),
        size: file.size,
        localPath: `${projectName}/media/${file.name}`,
        url: URL.createObjectURL(file) // For immediate use
      };
    } catch (error) {
      console.error('Error saving media file:', error);
      throw new Error('Failed to save media file');
    }
  }

  /**
   * Get media file from project directory
   */
  async getMediaFile(projectName: string, fileName: string): Promise<File> {
    if (!this.projectDirectory) {
      throw new Error('No project directory selected');
    }

    try {
      const projectDir = await this.projectDirectory.getDirectoryHandle(projectName);
      const mediaDir = await projectDir.getDirectoryHandle('media');
      const fileHandle = await mediaDir.getFileHandle(fileName);
      
      return await fileHandle.getFile();
    } catch (error) {
      console.error('Error getting media file:', error);
      throw new Error('Failed to get media file');
    }
  }

  /**
   * List all projects in directory
   */
  async listProjects(): Promise<string[]> {
    if (!this.projectDirectory) {
      throw new Error('No project directory selected');
    }

    const projects: string[] = [];
    
    try {
      for await (const [name, handle] of this.projectDirectory.entries()) {
        if (handle.kind === 'directory') {
          // Check if it has a project.json file
          try {
            const dirHandle = handle as FileSystemDirectoryHandle;
            await dirHandle.getFileHandle('project.json');
            projects.push(name);
          } catch {
            // Skip directories without project.json
          }
        }
      }
    } catch (error) {
      console.error('Error listing projects:', error);
    }
    
    return projects;
  }

  private getFileType(mimeType: string): 'video' | 'audio' | 'image' {
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    if (mimeType.startsWith('image/')) return 'image';
    return 'video'; // default
  }
}