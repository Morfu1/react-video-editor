// Project and storage type definitions
export type StorageLocation = 'local' | 'drive' | 'both';

export interface Project {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  thumbnail?: string;
  
  // Video editor specific data
  timeline: any; // Your existing timeline data
  settings: ProjectSettings;
  mediaFiles: MediaFile[];
  
  // Storage metadata
  storage: {
    location: StorageLocation;
    localPath?: string;
    driveFileId?: string;
    lastSync?: string;
  };
}

export interface MediaFile {
  id: string;
  name: string;
  type: 'video' | 'audio' | 'image';
  size: number;
  localPath?: string;
  driveFileId?: string;
  url?: string; // For display purposes
  thumbnail?: string;
}

export interface ProjectSettings {
  resolution: { width: number; height: number };
  fps: number;
  quality: string;
}

export interface AuthState {
  user: GoogleUser | null;
  mode: 'guest' | 'authenticated';
  driveConnected: boolean;
  accessToken?: string;
}

export interface GoogleUser {
  id: string;
  email: string;
  name: string;
  avatar: string;
  provider: 'google';
}

export interface StorageCapabilities {
  fileSystemAccess: boolean;
  indexedDB: boolean;
  googleDrive: boolean;
}