import { Project, MediaFile } from '@/types/project';

export class DriveStorageService {
  private gapi: any;

  constructor() {
    this.gapi = window.gapi;
  }

  /**
   * Create a project folder in Google Drive
   */
  async createProjectFolder(projectName: string): Promise<string> {
    try {
      const response = await this.gapi.client.drive.files.create({
        resource: {
          name: `VideoEditor_${projectName}`,
          mimeType: 'application/vnd.google-apps.folder',
          parents: ['appDataFolder'], // Store in app-specific folder
        },
      });

      return response.result.id;
    } catch (error) {
      console.error('Error creating project folder:', error);
      throw new Error('Failed to create project folder in Drive');
    }
  }

  /**
   * Upload project metadata to Google Drive
   */
  async uploadProjectMetadata(project: Project, folderId: string): Promise<string> {
    try {
      const metadata = {
        name: 'project.json',
        parents: [folderId],
      };

      const media = {
        mimeType: 'application/json',
        body: JSON.stringify(project, null, 2),
      };

      const response = await this.gapi.client.request({
        path: 'https://www.googleapis.com/upload/drive/v3/files',
        method: 'POST',
        params: {
          uploadType: 'multipart',
        },
        headers: {
          'Content-Type': 'multipart/related; boundary="foo_bar_baz"',
        },
        body: this.createMultipartBody(metadata, media),
      });

      return response.result.id;
    } catch (error) {
      console.error('Error uploading project metadata:', error);
      throw new Error('Failed to upload project metadata to Drive');
    }
  }

  /**
   * Download project metadata from Google Drive
   */
  async downloadProjectMetadata(fileId: string): Promise<Project> {
    try {
      const response = await this.gapi.client.drive.files.get({
        fileId: fileId,
        alt: 'media',
      });

      return JSON.parse(response.body) as Project;
    } catch (error) {
      console.error('Error downloading project metadata:', error);
      throw new Error('Failed to download project metadata from Drive');
    }
  }

  /**
   * Upload media file to Google Drive with resumable upload
   */
  async uploadMediaFile(
    file: File, 
    folderId: string, 
    onProgress?: (progress: number) => void
  ): Promise<string> {
    try {
      // Start resumable upload session
      const metadata = {
        name: file.name,
        parents: [folderId],
      };

      // Initialize resumable upload
      const initResponse = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.getAccessToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(metadata),
      });

      if (!initResponse.ok) {
        throw new Error('Failed to initialize upload');
      }

      const uploadUrl = initResponse.headers.get('Location');
      if (!uploadUrl) {
        throw new Error('No upload URL received');
      }

      // Upload file in chunks
      return await this.resumableUpload(file, uploadUrl, onProgress);
    } catch (error) {
      console.error('Error uploading media file:', error);
      throw new Error('Failed to upload media file to Drive');
    }
  }

  /**
   * Perform resumable upload
   */
  private async resumableUpload(
    file: File, 
    uploadUrl: string, 
    onProgress?: (progress: number) => void
  ): Promise<string> {
    const chunkSize = 256 * 1024; // 256KB chunks
    let start = 0;

    while (start < file.size) {
      const end = Math.min(start + chunkSize, file.size);
      const chunk = file.slice(start, end);

      const response = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Range': `bytes ${start}-${end - 1}/${file.size}`,
          'Content-Type': file.type,
        },
        body: chunk,
      });

      if (response.status === 200 || response.status === 201) {
        // Upload complete
        const result = await response.json();
        return result.id;
      } else if (response.status === 308) {
        // Continue uploading
        const range = response.headers.get('Range');
        if (range) {
          const rangeEnd = parseInt(range.split('-')[1]) + 1;
          start = rangeEnd;
        } else {
          start = end;
        }

        // Report progress
        if (onProgress) {
          onProgress((start / file.size) * 100);
        }
      } else {
        throw new Error(`Upload failed with status ${response.status}`);
      }
    }

    throw new Error('Upload completed without receiving file ID');
  }

  /**
   * Download media file from Google Drive
   */
  async downloadMediaFile(fileId: string): Promise<Blob> {
    try {
      const response = await this.gapi.client.drive.files.get({
        fileId: fileId,
        alt: 'media',
      });

      // Convert response to blob
      const blob = new Blob([response.body], { 
        type: response.headers['content-type'] 
      });
      
      return blob;
    } catch (error) {
      console.error('Error downloading media file:', error);
      throw new Error('Failed to download media file from Drive');
    }
  }

  /**
   * List project folders in Drive
   */
  async listProjectFolders(): Promise<Array<{ id: string; name: string; modifiedTime: string }>> {
    try {
      if (!this.gapi?.client?.drive) {
        console.warn('Google API client not initialized');
        return [];
      }

      const response = await this.gapi.client.drive.files.list({
        q: "mimeType='application/vnd.google-apps.folder' and name contains 'VideoEditor_' and parents in 'appDataFolder'",
        fields: 'files(id, name, modifiedTime)',
        orderBy: 'modifiedTime desc',
      });

      return response.result.files || [];
    } catch (error) {
      console.error('Error listing project folders:', error);
      throw new Error('Failed to list project folders from Drive');
    }
  }

  /**
   * Delete file or folder from Drive
   */
  async deleteFile(fileId: string): Promise<void> {
    try {
      await this.gapi.client.drive.files.delete({
        fileId: fileId,
      });
    } catch (error) {
      console.error('Error deleting file from Drive:', error);
      throw new Error('Failed to delete file from Drive');
    }
  }

  /**
   * Share project folder with others
   */
  async shareProject(folderId: string, email: string, role: 'reader' | 'writer' = 'reader'): Promise<void> {
    try {
      await this.gapi.client.drive.permissions.create({
        fileId: folderId,
        resource: {
          role: role,
          type: 'user',
          emailAddress: email,
        },
        sendNotificationEmail: true,
      });
    } catch (error) {
      console.error('Error sharing project:', error);
      throw new Error('Failed to share project');
    }
  }

  /**
   * Get shareable link for project
   */
  async getShareableLink(folderId: string): Promise<string> {
    try {
      // Make the folder publicly viewable
      await this.gapi.client.drive.permissions.create({
        fileId: folderId,
        resource: {
          role: 'reader',
          type: 'anyone',
        },
      });

      // Get the file details with webViewLink
      const response = await this.gapi.client.drive.files.get({
        fileId: folderId,
        fields: 'webViewLink',
      });

      return response.result.webViewLink;
    } catch (error) {
      console.error('Error getting shareable link:', error);
      throw new Error('Failed to get shareable link');
    }
  }

  private createMultipartBody(metadata: any, media: any): string {
    const delimiter = 'foo_bar_baz';
    const close_delim = `\r\n--${delimiter}--`;
    
    let body = `--${delimiter}\r\n`;
    body += 'Content-Type: application/json\r\n\r\n';
    body += JSON.stringify(metadata) + '\r\n';
    body += `--${delimiter}\r\n`;
    body += `Content-Type: ${media.mimeType}\r\n\r\n`;
    body += media.body;
    body += close_delim;
    
    return body;
  }

  private getAccessToken(): string {
    return localStorage.getItem('google_access_token') || '';
  }
}