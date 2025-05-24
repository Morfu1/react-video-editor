// File System Access API capability detection and debugging

export interface FileSystemCapabilities {
  showDirectoryPicker: boolean;
  showOpenFilePicker: boolean;
  showSaveFilePicker: boolean;
  secureContext: boolean;
  protocol: string;
  hostname: string;
  isLocalhost: boolean;
  supported: boolean;
  reason?: string;
}

export function detectFileSystemCapabilities(): FileSystemCapabilities {
  const hasShowDirectoryPicker = 'showDirectoryPicker' in window;
  const hasShowOpenFilePicker = 'showOpenFilePicker' in window;
  const hasShowSaveFilePicker = 'showSaveFilePicker' in window;
  const isSecureContext = window.isSecureContext;
  const protocol = window.location.protocol;
  const hostname = window.location.hostname;
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
  
  let supported = false;
  let reason = '';

  if (!hasShowDirectoryPicker) {
    reason = 'showDirectoryPicker not available in this browser';
  } else if (!isSecureContext && !isLocalhost) {
    reason = 'Requires secure context (HTTPS) for non-localhost';
  } else if (protocol === 'http:' && !isLocalhost) {
    reason = 'HTTP only supported on localhost';
  } else {
    supported = true;
    reason = 'File System Access API is available';
  }

  return {
    showDirectoryPicker: hasShowDirectoryPicker,
    showOpenFilePicker: hasShowOpenFilePicker,
    showSaveFilePicker: hasShowSaveFilePicker,
    secureContext: isSecureContext,
    protocol,
    hostname,
    isLocalhost,
    supported,
    reason
  };
}

export function logFileSystemCapabilities(): void {
  const capabilities = detectFileSystemCapabilities();
  console.group('🗂️ File System Access API Capabilities');
  console.log('Full capabilities:', capabilities);
  console.log('User Agent:', navigator.userAgent);
  console.log('Supported:', capabilities.supported ? '✅' : '❌', capabilities.reason);
  console.groupEnd();
}

// Test function to validate the API works
export async function testFileSystemAccess(): Promise<boolean> {
  const capabilities = detectFileSystemCapabilities();
  
  if (!capabilities.supported) {
    console.warn('File System Access API not supported:', capabilities.reason);
    return false;
  }

  try {
    // Test if we can actually call the API (without showing UI)
    const hasPermission = await navigator.permissions?.query?.({ name: 'read-write' as any });
    console.log('File system permission status:', hasPermission?.state);
    return true;
  } catch (error) {
    console.warn('File System Access API test failed:', error);
    return false;
  }
}