import { useState, useEffect, useCallback } from 'react';
import { GoogleAuthService } from '@/services/auth/googleAuthService';
import { AuthState, GoogleUser } from '@/types/project';

const authService = new GoogleAuthService();

export const useGoogleAuth = () => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    mode: 'guest',
    driveConnected: false,
  });
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize auth service and check existing session
  useEffect(() => {
    const initAuth = async () => {
      try {
        await authService.init();
        
        // Check if user is already authenticated
        if (authService.isAuthenticated()) {
          const user = authService.getCurrentUser();
          if (user) {
            authService.setAccessToken();
            setAuthState({
              user,
              mode: 'authenticated',
              driveConnected: true,
              accessToken: authService.getAccessToken() || undefined,
            });
          }
        }
      } catch (err) {
        console.error('Auth initialization error:', err);
        setError('Failed to initialize authentication');
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  /**
   * Sign in with Google
   */
  const signIn = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const user = await authService.signIn();
      authService.setAccessToken();
      
      setAuthState({
        user,
        mode: 'authenticated',
        driveConnected: true,
        accessToken: authService.getAccessToken() || undefined,
      });
    } catch (err: any) {
      console.error('Sign in error:', err);
      setError(err.message || 'Failed to sign in');
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Sign out
   */
  const signOut = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    
    try {
      await authService.signOut();
      setAuthState({
        user: null,
        mode: 'guest',
        driveConnected: false,
      });
    } catch (err: any) {
      console.error('Sign out error:', err);
      setError(err.message || 'Failed to sign out');
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Refresh access token
   */
  const refreshToken = useCallback(async (): Promise<boolean> => {
    try {
      // In a real implementation, you'd handle token refresh here
      // For now, just check if the token is still valid
      if (authState.mode === 'authenticated') {
        authService.setAccessToken();
        return true;
      }
      return false;
    } catch (err) {
      console.error('Token refresh error:', err);
      return false;
    }
  }, [authState.mode]);

  /**
   * Connect to Drive (same as sign in for now)
   */
  const connectDrive = useCallback((): Promise<void> => {
    return signIn();
  }, [signIn]);

  /**
   * Disconnect from Drive (but keep user authenticated for other Google services)
   */
  const disconnectDrive = useCallback((): Promise<void> => {
    // For simplicity, we'll sign out completely
    // In a more complex app, you might want to just revoke Drive permissions
    return signOut();
  }, [signOut]);

  return {
    // Auth state
    user: authState.user,
    mode: authState.mode,
    driveConnected: authState.driveConnected,
    isAuthenticated: authState.mode === 'authenticated',
    accessToken: authState.accessToken,
    
    // Loading and error states
    isLoading,
    error,
    
    // Actions
    signIn,
    signOut,
    connectDrive,
    disconnectDrive,
    refreshToken,
    
    // Utilities
    clearError: () => setError(null),
  };
};