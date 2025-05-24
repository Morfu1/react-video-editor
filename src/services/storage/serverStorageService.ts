import { MediaFile, Project } from '@/types/project';

export class ServerStorageService {
  private baseURL: string;

  constructor() {
    // Use the current origin for development
    this.baseURL = window.location.origin.replace(':5173', ':3030'); // Vite dev port to Express port
  }

  /**
   * Upload a file to the server
   */
  async uploadFile(file: File, projectId: string): Promise<MediaFile> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('projectId', projectId);

    try {
      const response = await fetch(`${this.baseURL}/api/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
      }

      const mediaFile = await response.json();
      
      // Convert relative URL to absolute URL
      if (mediaFile.url.startsWith('/')) {
        mediaFile.url = `${this.baseURL}${mediaFile.url}`;
      }

      return mediaFile;
    } catch (error) {
      console.error('Server upload error:', error);
      throw error;
    }
  }

  /**
   * Check if server is available
   */
  async isServerAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseURL}/api/health`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        }
      });
      return response.ok;
    } catch (error) {
      console.warn('Server not available:', error);
      return false;
    }
  }

  /**
   * Delete a file from the server
   */
  async deleteFile(filePath: string): Promise<void> {
    try {
      await fetch(`${this.baseURL}/api/upload/${encodeURIComponent(filePath)}`, {
        method: 'DELETE',
      });
    } catch (error) {
      console.error('Error deleting file from server:', error);
      // Don't throw - file deletion is not critical
    }
  }
}

export const serverStorageService = new ServerStorageService();