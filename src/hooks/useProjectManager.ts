import { useState, useEffect, useCallback, useRef } from 'react';
import { Project, MediaFile } from '@/types/project';
import { HybridStorageService, StorageLocation } from '@/services/storage/hybridStorageService';
import { useGoogleAuth } from './useGoogleAuth';
import useStore from '@/features/editor/store/use-store';

const storageService = new HybridStorageService();

export const useProjectManager = () => {
  const { driveConnected } = useGoogleAuth();
  const { getTimelineState, loadTimelineState, clearTimeline, setCurrentProjectId } = useStore();
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mediaFileQueue = useRef(new Map<string, Promise<any>>());

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
      
      // Clear timeline for new project
      clearTimeline();
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
      
      // Set current project first before loading timeline to prevent auto-save during load
      setCurrentProject(project);
      setCurrentProjectId(project?.id || null);
      
      // Clear current timeline first
      clearTimeline();
      
      if (project?.timeline) {
        console.log('Loading timeline state for project:', projectId);
        console.log('Timeline data:', JSON.stringify({
          tracks: project.timeline.tracks?.length || 0,
          trackItemIds: project.timeline.trackItemIds?.length || 0,
          trackItemsMap: Object.keys(project.timeline.trackItemsMap || {}).length
        }));
        
        // Store timeline data for restoration when timeline component is ready
        (window as any).__pendingTimelineRestore = project.timeline;
        
        // Also load into store
        loadTimelineState(project.timeline);
        
        console.log('Timeline data loaded and stored for restoration');
      } else {
        console.log('No timeline data found for project:', projectId);
      }
      return project;
    } catch (err: any) {
      console.error('loadProject error:', err);
      setError(err.message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [clearTimeline, loadTimelineState]);

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
      // Get current timeline state and include it in the project
      const timelineState = getTimelineState();
      console.log('saveProject - timeline state:', JSON.stringify({
        tracks: timelineState.tracks?.length || 0,
        trackItemIds: timelineState.trackItemIds?.length || 0,
        trackItemsMap: Object.keys(timelineState.trackItemsMap || {}).length
      }));
      const projectWithTimeline = {
        ...project,
        timeline: timelineState,
        updatedAt: new Date().toISOString()
      };
      
      const savedProject = await storageService.saveProject(
        projectWithTimeline, 
        location || project.storage.location
      );
      
      console.log('saveProject - saved project with timeline, media files:', savedProject.mediaFiles.length);
      // Only update currentProject if the saved version has same or more media files
      // This prevents race conditions during file uploads where we might override with stale data
      if (!currentProject || 
          savedProject.mediaFiles.length >= currentProject.mediaFiles.length ||
          currentProject.updatedAt <= savedProject.updatedAt) {
        setCurrentProject(savedProject);
      }
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
  }, [getTimelineState]);

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
        setCurrentProjectId(null);
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
    setError(null);

    // Wait for any pending operations for this project
    const existingOperation = mediaFileQueue.current.get(projectId);
    if (existingOperation) {
      await existingOperation;
    }

    // Create a new operation promise that does everything atomically
    const operation = (async () => {
      try {
        setIsLoading(true);
        
        // Save the media file first
        const mediaFile = await storageService.saveMediaFile(
          projectId, 
          file, 
          location, 
          onProgress
        );

        // Always load fresh project data to ensure we have the latest state
        const loadedProject = await storageService.loadProject(projectId);
        if (!loadedProject) throw new Error('Project not found');

        console.log('Before update - existing media files:', loadedProject.mediaFiles.length);
        console.log('Existing files:', loadedProject.mediaFiles.map(f => f.name));
        console.log('Adding new file:', mediaFile.name);
        
        const updatedProject = {
          ...loadedProject,
          mediaFiles: [...loadedProject.mediaFiles, mediaFile],
          updatedAt: new Date().toISOString(),
        };
        
        console.log('After update - media files count:', updatedProject.mediaFiles.length);
        console.log('All files after update:', updatedProject.mediaFiles.map(f => f.name));
        
        // Update the current project state immediately
        setCurrentProject(updatedProject);
        
        // Save the project
        await storageService.saveProject(updatedProject, driveConnected ? 'both' : 'local');
        
        // Update the projects list
        setProjects(prev => 
          prev.map(p => p.id === updatedProject.id ? updatedProject : p)
        );

        return mediaFile;
      } catch (err: any) {
        setError(err.message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    })();

    // Queue this operation
    mediaFileQueue.current.set(projectId, operation);
    
    try {
      const result = await operation;
      return result;
    } finally {
      // Clean up after operation completes
      mediaFileQueue.current.delete(projectId);
    }
  }, [driveConnected]);

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

  /**
   * Save current timeline state to the current project
   */
  const saveCurrentTimeline = useCallback(async (): Promise<void> => {
    if (!currentProject) {
      throw new Error('No current project to save timeline to');
    }
    
    await saveProject(currentProject);
  }, [currentProject, saveProject]);

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
    saveCurrentTimeline,
  };
};