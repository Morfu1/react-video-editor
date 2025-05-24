import { useState, useEffect, useCallback } from 'react';
import { Project, MediaFile } from '@/types/project';
import { HybridStorageService, StorageLocation } from '@/services/storage/hybridStorageService';
import { useGoogleAuth } from './useGoogleAuth';

const storageService = new HybridStorageService();

export const useProjectManager = () => {
  const { driveConnected } = useGoogleAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize storage service
  useEffect(() => {
    const initStorage = async () => {
      try {
        await storageService.init();
        await loadProjects();
      } catch (err: any) {
        setError(err.message);
      }
    };

    initStorage();
  }, []);

  /**
   * Load all projects from storage
   */
  const loadProjects = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const projectList = await storageService.listProjects();
      setProjects(projectList);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Create a new project
   */
  const createProject = useCallback(async (
    name: string, 
    description?: string,
    location: StorageLocation = 'local'
  ): Promise<Project> => {
    setIsLoading(true);
    setError(null);

    try {
      const project: Project = {
        id: crypto.randomUUID(),
        name: name.trim(),
        description: description?.trim(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        timeline: null, // Will be populated by video editor
        settings: {
          resolution: { width: 1920, height: 1080 },
          fps: 30,
          duration: 30000, // 30 seconds default
          quality: 'high',
        },
        mediaFiles: [],
        storage: {
          location,
        },
      };

      const savedProject = await storageService.saveProject(project, location);
      setProjects(prev => [savedProject, ...prev]);
      setCurrentProject(savedProject);
      
      return savedProject;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Load a project
   */
  const loadProject = useCallback(async (projectId: string): Promise<Project | null> => {
    setIsLoading(true);
    setError(null);

    try {
      console.log('loadProject called for:', projectId);
      const project = await storageService.loadProject(projectId);
      console.log('loadProject result:', project?.id, 'media files:', project?.mediaFiles?.length);
      setCurrentProject(project);
      return project;
    } catch (err: any) {
      console.error('loadProject error:', err);
      setError(err.message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Save current project
   */
  const saveProject = useCallback(async (
    project: Project, 
    location?: StorageLocation
  ): Promise<Project> => {
    setIsLoading(true);
    setError(null);

    try {
      const savedProject = await storageService.saveProject(
        project, 
        location || project.storage.location
      );
      
      console.log('saveProject - saved project media files:', savedProject.mediaFiles.length);
      setCurrentProject(savedProject);
      setProjects(prev => 
        prev.map(p => p.id === savedProject.id ? savedProject : p)
      );
      
      return savedProject;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Delete a project
   */
  const deleteProject = useCallback(async (
    projectId: string, 
    location: StorageLocation = 'local'
  ): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      // Optimistically update UI first for better UX
      setProjects(prev => prev.filter(p => p.id !== projectId));
      
      if (currentProject?.id === projectId) {
        setCurrentProject(null);
      }

      // Attempt to delete from storage - only try local for now
      await storageService.deleteProject(projectId, 'local');
    } catch (err: any) {
      console.warn('Failed to delete project from storage, but removed from UI:', err.message);
      // Don't restore the project since it might be partially deleted
      // The optimistic UI update stays
    } finally {
      setIsLoading(false);
    }
  }, [currentProject]);

  /**
   * Sync project between local and drive
   */
  const syncProject = useCallback(async (projectId: string): Promise<Project | null> => {
    if (!driveConnected) {
      throw new Error('Google Drive not connected');
    }

    setIsLoading(true);
    setError(null);

    try {
      const syncedProject = await storageService.syncProject(projectId);
      if (syncedProject) {
        setProjects(prev => 
          prev.map(p => p.id === syncedProject.id ? syncedProject : p)
        );
        
        if (currentProject?.id === projectId) {
          setCurrentProject(syncedProject);
        }
      }
      return syncedProject;
    } catch (err: any) {
      setError(err.message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [driveConnected, currentProject]);

  /**
   * Add media file to project
   */
  const addMediaFile = useCallback(async (
    projectId: string,
    file: File,
    location: StorageLocation = 'local',
    onProgress?: (progress: number) => void
  ): Promise<MediaFile> => {
    setIsLoading(true);
    setError(null);

    try {
      const mediaFile = await storageService.saveMediaFile(
        projectId, 
        file, 
        location, 
        onProgress
      );

      // Update project with new media file
      if (currentProject?.id === projectId) {
        console.log('Before update - existing media files:', currentProject.mediaFiles.length);
        const updatedProject = {
          ...currentProject,
          mediaFiles: [...currentProject.mediaFiles, mediaFile],
          updatedAt: new Date().toISOString(),
        };
        console.log('After update - media files count:', updatedProject.mediaFiles.length);
        
        await saveProject(updatedProject);
      } else {
        // If currentProject doesn't match (e.g., newly created project), load and update it
        const project = await storageService.loadProject(projectId);
        if (project) {
          const updatedProject = {
            ...project,
            mediaFiles: [...project.mediaFiles, mediaFile],
            updatedAt: new Date().toISOString(),
          };
          
          await saveProject(updatedProject);
          // Set this as current project if none is set
          if (!currentProject) {
            setCurrentProject(updatedProject);
          }
        }
      }

      return mediaFile;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [currentProject, saveProject]);

  /**
   * Get media files for project
   */
  const getProjectMediaFiles = useCallback(async (projectId: string): Promise<MediaFile[]> => {
    try {
      return await storageService.getProjectMediaFiles(projectId);
    } catch (err: any) {
      setError(err.message);
      return [];
    }
  }, []);

  /**
   * Remove media file from project (not from storage)
   */
  const removeMediaFileFromProject = useCallback(async (
    projectId: string,
    mediaFileId: string
  ): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      if (currentProject?.id === projectId) {
        const updatedProject = {
          ...currentProject,
          mediaFiles: currentProject.mediaFiles.filter(file => file.id !== mediaFileId),
          updatedAt: new Date().toISOString(),
        };
        
        await saveProject(updatedProject);
      } else {
        // If currentProject doesn't match, load and update it
        const project = await storageService.loadProject(projectId);
        if (project) {
          const updatedProject = {
            ...project,
            mediaFiles: project.mediaFiles.filter(file => file.id !== mediaFileId),
            updatedAt: new Date().toISOString(),
          };
          
          await saveProject(updatedProject);
        }
      }
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [currentProject, saveProject]);

  /**
   * Duplicate a project
   */
  const duplicateProject = useCallback(async (
    projectId: string, 
    newName: string
  ): Promise<Project> => {
    setIsLoading(true);
    setError(null);

    try {
      const originalProject = await storageService.loadProject(projectId);
      if (!originalProject) {
        throw new Error('Project not found');
      }

      const duplicatedProject: Project = {
        ...originalProject,
        id: crypto.randomUUID(),
        name: newName,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        storage: {
          location: 'local', // Default to local for duplicated projects
        },
      };

      const savedProject = await storageService.saveProject(duplicatedProject);
      setProjects(prev => [savedProject, ...prev]);
      
      return savedProject;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    // State
    projects,
    currentProject,
    isLoading,
    error,

    // Actions
    loadProjects,
    createProject,
    loadProject,
    saveProject,
    deleteProject,
    syncProject,
    duplicateProject,
    
    // Media management
    addMediaFile,
    getProjectMediaFiles,
    removeMediaFileFromProject,

    // Utilities
    clearError: () => setError(null),
    setCurrentProject,
  };
};