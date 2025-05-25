import { Project, MediaFile } from '@/types/project';

const DB_NAME = 'VideoEditorProjects';
const DB_VERSION = 1;
const PROJECTS_STORE = 'projects';
const MEDIA_STORE = 'mediaFiles';

export class IndexedDBService {
  private db: IDBDatabase | null = null;
  private saveQueue = new Map<string, Promise<void>>();

  /**
   * Initialize IndexedDB
   */
  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        reject(new Error('Failed to open IndexedDB'));
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create projects store
        if (!db.objectStoreNames.contains(PROJECTS_STORE)) {
          const projectStore = db.createObjectStore(PROJECTS_STORE, { keyPath: 'id' });
          projectStore.createIndex('name', 'name', { unique: false });
          projectStore.createIndex('updatedAt', 'updatedAt', { unique: false });
        }

        // Create media files store
        if (!db.objectStoreNames.contains(MEDIA_STORE)) {
          const mediaStore = db.createObjectStore(MEDIA_STORE, { keyPath: 'id' });
          mediaStore.createIndex('projectId', 'projectId', { unique: false });
        }
      };
    });
  }

  /**
   * Save project to IndexedDB
   */
  async saveProject(project: Project): Promise<void> {
    if (!this.db) throw new Error('IndexedDB not initialized');

    // Wait for any pending save operations for this project to complete
    const existingPromise = this.saveQueue.get(project.id);
    if (existingPromise) {
      await existingPromise;
    }

    // Queue this save operation
    const savePromise = this.performSave(project);
    this.saveQueue.set(project.id, savePromise);
    
    try {
      await savePromise;
    } finally {
      // Clean up after save completes
      this.saveQueue.delete(project.id);
    }
  }

  private async performSave(project: Project): Promise<void> {
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([PROJECTS_STORE], 'readwrite');
      const store = transaction.objectStore(PROJECTS_STORE);
      
      const request = store.put(project);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to save project'));
    });
  }

  /**
   * Load project from IndexedDB
   */
  async loadProject(projectId: string): Promise<Project | null> {
    if (!this.db) throw new Error('IndexedDB not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([PROJECTS_STORE], 'readonly');
      const store = transaction.objectStore(PROJECTS_STORE);
      
      const request = store.get(projectId);
      
      request.onsuccess = () => {
        resolve(request.result || null);
      };
      request.onerror = () => reject(new Error('Failed to load project'));
    });
  }

  /**
   * List all projects
   */
  async listProjects(): Promise<Project[]> {
    if (!this.db) throw new Error('IndexedDB not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([PROJECTS_STORE], 'readonly');
      const store = transaction.objectStore(PROJECTS_STORE);
      
      const request = store.getAll();
      
      request.onsuccess = () => {
        resolve(request.result || []);
      };
      request.onerror = () => reject(new Error('Failed to list projects'));
    });
  }

  /**
   * Save media file as blob
   */
  async saveMediaFile(projectId: string, file: File): Promise<MediaFile> {
    if (!this.db) throw new Error('IndexedDB not initialized');

    const mediaFile: MediaFile & { blob: Blob; projectId: string } = {
      id: crypto.randomUUID(),
      name: file.name,
      type: this.getFileType(file.type),
      size: file.size,
      url: URL.createObjectURL(file),
      blob: file,
      projectId
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([MEDIA_STORE], 'readwrite');
      const store = transaction.objectStore(MEDIA_STORE);
      
      const request = store.put(mediaFile);
      
      request.onsuccess = () => {
        const { blob, projectId, ...result } = mediaFile;
        resolve(result);
      };
      request.onerror = () => reject(new Error('Failed to save media file'));
    });
  }

  /**
   * Get media files for project
   */
  async getProjectMediaFiles(projectId: string): Promise<MediaFile[]> {
    if (!this.db) throw new Error('IndexedDB not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([MEDIA_STORE], 'readonly');
      const store = transaction.objectStore(MEDIA_STORE);
      const index = store.index('projectId');
      
      const request = index.getAll(projectId);
      
      request.onsuccess = () => {
        const files = request.result.map((item: any) => {
          const { blob, projectId, ...mediaFile } = item;
          if (blob) {
            mediaFile.url = URL.createObjectURL(blob);
          }
          return mediaFile;
        });
        resolve(files);
      };
      request.onerror = () => reject(new Error('Failed to get media files'));
    });
  }

  /**
   * Delete project and its media files
   */
  async deleteProject(projectId: string): Promise<void> {
    if (!this.db) throw new Error('IndexedDB not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([PROJECTS_STORE, MEDIA_STORE], 'readwrite');
      
      // Delete project
      const projectStore = transaction.objectStore(PROJECTS_STORE);
      projectStore.delete(projectId);
      
      // Delete associated media files
      const mediaStore = transaction.objectStore(MEDIA_STORE);
      const index = mediaStore.index('projectId');
      const request = index.openCursor(projectId);
      
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };
      
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(new Error('Failed to delete project'));
    });
  }

  private getFileType(mimeType: string): 'video' | 'audio' | 'image' {
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    if (mimeType.startsWith('image/')) return 'image';
    return 'video'; // default
  }
}