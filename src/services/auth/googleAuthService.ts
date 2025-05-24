import { AuthState, GoogleUser } from '@/types/project';

declare global {
  interface Window {
    google: any;
    gapi: any;
  }
}

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';
const SCOPES = 'https://www.googleapis.com/auth/drive.file';

export class GoogleAuthService {
  private gapi: any = null;
  private tokenClient: any = null;
  private isInitialized = false;

  /**
   * Initialize Google APIs
   */
  async init(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Load Google API script
      await this.loadGoogleAPI();
      
      // Initialize gapi
      await new Promise<void>((resolve, reject) => {
        window.gapi.load('client', {
          callback: resolve,
          onerror: reject
        });
      });

      // Initialize the Google API client
      await window.gapi.client.init({
        apiKey: import.meta.env.VITE_GOOGLE_API_KEY,
        discoveryDocs: [DISCOVERY_DOC],
      });

      // Initialize OAuth client
      this.tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: SCOPES,
        callback: '', // Will be set when needed
      });

      this.gapi = window.gapi;
      this.isInitialized = true;
      
    } catch (error) {
      console.error('Failed to initialize Google Auth:', error);
      throw new Error('Failed to initialize Google authentication');
    }
  }

  /**
   * Sign in with Google
   */
  async signIn(): Promise<GoogleUser> {
    if (!this.isInitialized) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      this.tokenClient.callback = async (response: any) => {
        if (response.error) {
          reject(new Error(response.error));
          return;
        }

        try {
          // Get user profile information
          const userInfo = await this.getUserProfile();
          
          // Store access token
          localStorage.setItem('google_access_token', response.access_token);
          localStorage.setItem('google_user', JSON.stringify(userInfo));
          
          resolve(userInfo);
        } catch (error) {
          reject(error);
        }
      };

      this.tokenClient.requestAccessToken({ prompt: 'consent' });
    });
  }

  /**
   * Sign out
   */
  async signOut(): Promise<void> {
    const token = localStorage.getItem('google_access_token');
    
    if (token) {
      // Revoke the token
      window.google.accounts.oauth2.revoke(token, () => {
        console.log('Token revoked');
      });
    }

    // Clear stored data
    localStorage.removeItem('google_access_token');
    localStorage.removeItem('google_user');
    
    // Reset gapi auth
    if (this.gapi?.client) {
      this.gapi.client.setToken('');
    }
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    const token = localStorage.getItem('google_access_token');
    const user = localStorage.getItem('google_user');
    return !!(token && user);
  }

  /**
   * Get current user from storage
   */
  getCurrentUser(): GoogleUser | null {
    const userJson = localStorage.getItem('google_user');
    return userJson ? JSON.parse(userJson) : null;
  }

  /**
   * Get access token
   */
  getAccessToken(): string | null {
    return localStorage.getItem('google_access_token');
  }

  /**
   * Set access token for API calls
   */
  setAccessToken(): void {
    const token = this.getAccessToken();
    if (token && this.gapi?.client) {
      this.gapi.client.setToken({ access_token: token });
    }
  }

  /**
   * Get user profile from Google
   */
  private async getUserProfile(): Promise<GoogleUser> {
    try {
      const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: {
          Authorization: `Bearer ${this.getAccessToken()}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to get user profile');
      }

      const data = await response.json();
      
      return {
        id: data.id,
        email: data.email,
        name: data.name,
        avatar: data.picture,
        provider: 'google'
      };
    } catch (error) {
      console.error('Error getting user profile:', error);
      throw new Error('Failed to get user profile');
    }
  }

  /**
   * Load Google API script dynamically
   */
  private loadGoogleAPI(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (window.gapi && window.google) {
        resolve();
        return;
      }

      // Load Google Identity Services
      const gisScript = document.createElement('script');
      gisScript.src = 'https://accounts.google.com/gsi/client';
      gisScript.async = true;
      gisScript.defer = true;
      
      // Load Google API
      const gapiScript = document.createElement('script');
      gapiScript.src = 'https://apis.google.com/js/api.js';
      gapiScript.async = true;
      gapiScript.defer = true;

      let scriptsLoaded = 0;
      const onScriptLoad = () => {
        scriptsLoaded++;
        if (scriptsLoaded === 2) {
          resolve();
        }
      };

      gisScript.onload = onScriptLoad;
      gapiScript.onload = onScriptLoad;
      
      gisScript.onerror = reject;
      gapiScript.onerror = reject;

      document.head.appendChild(gisScript);
      document.head.appendChild(gapiScript);
    });
  }
}