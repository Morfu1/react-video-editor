import { StorageCapabilities } from '@/types/project';

/**
 * Detect browser storage capabilities
 */
export const detectStorageCapabilities = (): StorageCapabilities => {
  return {
    fileSystemAccess: 'showDirectoryPicker' in window,
    indexedDB: 'indexedDB' in window,
    googleDrive: true, // API always available, depends on auth
  };
};

/**
 * Check if File System Access API is supported
 */
export const isFileSystemAccessSupported = (): boolean => {
  return 'showDirectoryPicker' in window;
};

/**
 * Check if running in secure context (required for File System Access)
 */
export const isSecureContext = (): boolean => {
  return window.isSecureContext;
};

/**
 * Get recommended storage method based on capabilities
 */
export const getRecommendedStorageMethod = (): 'filesystem' | 'indexeddb' => {
  if (isFileSystemAccessSupported() && isSecureContext()) {
    return 'filesystem';
  }
  return 'indexeddb';
};