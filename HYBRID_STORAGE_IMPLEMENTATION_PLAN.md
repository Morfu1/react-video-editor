# React Video Editor: Hybrid Storage Implementation Plan

## 📋 Project Overview

**Goal**: Implement local-first storage with optional Google Drive backup/sharing for video editor projects.

**Architecture**: Local File System API + IndexedDB + Google Drive API + Optional OAuth

**User Experience**: Start with local-only editing, optionally upgrade to cloud backup/sharing

---

## 🏗️ Phase 1: Foundation Setup (Week 1)

### **Step 1.1: Project Structure Setup**

Create the following directory structure:

```
src/
├── services/
│   ├── storage/
│   │   ├── localStorageService.ts
│   │   ├── driveStorageService.ts
│   │   └── hybridStorageService.ts
│   └── auth/
│       └── googleAuthService.ts
├── hooks/
│   ├── useLocalProjects.ts
│   ├── useGoogleAuth.ts
│   └── useProjectManager.ts
├── types/
│   └── project.ts
└── utils/
    ├── fileSystemAccess.ts
    └── indexedDB.ts
```

### **Step 1.2: Type Definitions**

✅ **COMPLETED**: `src/types/project.ts`
- Project interface with storage metadata
- MediaFile interface for video/audio/image files
- AuthState for Google authentication
- StorageCapabilities for browser feature detection

### **Step 1.3: Browser Capabilities Detection**

✅ **COMPLETED**: `src/utils/capabilities.ts`
- Detect File System Access API support
- Check IndexedDB availability
- Determine recommended storage method

---

## 🗄️ Phase 2: Local Storage Implementation (Week 2)

### **Step 2.1: File System Access API Service**

✅ **COMPLETED**: `src/services/storage/fileSystemService.ts`

**Key Features:**
- User directory selection for projects
- Project folder creation with subdirectories (media/, exports/)
- JSON metadata saving/loading
- Media file storage in local directories
- Project enumeration

**Usage Example:**
```typescript
const fsService = new FileSystemService();
await fsService.selectProjectDirectory();
await fsService.saveProjectMetadata(project);
const mediaFile = await fsService.saveMediaFile(projectName, file);
```

### **Step 2.2: IndexedDB Fallback Service**

✅ **COMPLETED**: `src/services/storage/indexedDBService.ts`

**Key Features:**
- IndexedDB initialization with object stores
- Project and media file storage as blobs
- Project listing and retrieval
- Automatic fallback for unsupported browsers

**Database Schema:**
- `projects` store: Project metadata
- `mediaFiles` store: File blobs with project association

---

## 🔐 Phase 3: Google Authentication (Week 3)

### **Step 3.1: Environment Configuration**

Create `.env` file:
```bash
VITE_GOOGLE_CLIENT_ID=your_google_client_id_here
VITE_GOOGLE_API_KEY=your_google_api_key_here
```

**Google Cloud Console Setup:**
1. Create new project or use existing
2. Enable Google Drive API
3. Create OAuth 2.0 credentials (Web application)
4. Add your domain to authorized origins
5. Copy Client ID and API Key to `.env`

### **Step 3.2: Google Auth Service**

✅ **COMPLETED**: `src/services/auth/googleAuthService.ts`

**Key Features:**
- Google API initialization with Drive scope
- OAuth 2.0 token management
- User profile retrieval
- Token storage and validation
- Sign in/out functionality

**Scopes Required:**
- `https://www.googleapis.com/auth/drive.file` - Create and edit files

### **Step 3.3: Google Auth Hook**

✅ **COMPLETED**: `src/hooks/useGoogleAuth.ts`

**Features:**
- Authentication state management
- Automatic session restoration
- Error handling and loading states
- Drive connection management

**Usage:**
```typescript
const { user, signIn, signOut, driveConnected, isLoading } = useGoogleAuth();
```

---

## ☁️ Phase 4: Google Drive Integration (Week 4)

### **Step 4.1: Google Drive Service**

✅ **COMPLETED**: `src/services/storage/driveStorageService.ts`

**Key Features:**
- Project folder creation in Drive
- Resumable uploads for large video files
- Project metadata sync (JSON files)
- Media file upload with progress tracking
- Project sharing and collaboration
- Folder listing and file management

**Important Methods:**
```typescript
// Create project folder
const folderId = await driveService.createProjectFolder(projectName);

// Upload with progress
const fileId = await driveService.uploadMediaFile(file, folderId, onProgress);

// Share project
await driveService.shareProject(folderId, email, 'reader');
```

### **Step 4.2: Resumable Upload Implementation**

**Features:**
- 256KB chunk uploads
- Network interruption recovery
- Progress tracking
- Large file support (GB+ videos)

**Error Handling:**
- Automatic retry on network failures
- Graceful degradation for unsupported browsers
- User feedback for upload status

---

## 🔄 Phase 5: Hybrid Storage Service (Week 5)

### **Step 5.1: Main Storage Controller**

✅ **COMPLETED**: `src/services/storage/hybridStorageService.ts`

**Key Features:**
- Unified interface for all storage backends
- Smart location selection (local/drive/both)
- Automatic conflict resolution
- Cross-platform sync capabilities
- Fallback handling

**Storage Locations:**
- `'local'`: File System API or IndexedDB
- `'drive'`: Google Drive
- `'both'`: Synchronized across platforms

### **Step 5.2: Sync Strategy**

**Conflict Resolution:**
- Last-modified timestamp comparison
- Merge strategy for project conflicts
- User notification for sync issues

**Sync Triggers:**
- Manual sync button
- Periodic background sync (if authenticated)
- Before project export

---

## 🎨 Phase 6: UI Integration (Week 6)

### **Step 6.1: Project Manager Hook**

✅ **COMPLETED**: `src/hooks/useProjectManager.ts`

**Features:**
- Project CRUD operations
- Media file management
- Storage location selection
- Sync coordination
- Error handling and loading states

### **Step 6.2: Upload Handler Update**

✅ **COMPLETED**: Updated `src/features/editor/scene/empty.tsx`
- Added TODO comments for integration
- Prepared async file handling
- Ready for project manager connection

---

## 🚀 Phase 7: UI Components (Week 7)

### **Step 7.1: Authentication Components**

Create these components:

#### **GoogleSignInButton**
```typescript
// src/components/auth/GoogleSignInButton.tsx
const GoogleSignInButton = () => {
  const { signIn, isLoading } = useGoogleAuth();
  
  return (
    <Button onClick={signIn} disabled={isLoading}>
      {isLoading ? 'Connecting...' : 'Connect Google Drive'}
    </Button>
  );
};
```

#### **UserDropdown**
```typescript
// src/components/auth/UserDropdown.tsx
const UserDropdown = ({ user, onSignOut }) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <Avatar src={user.avatar} alt={user.name} />
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onClick={onSignOut}>
          Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
```

### **Step 7.2: Project Management Components**

#### **ProjectPickerDialog**
```typescript
// src/components/projects/ProjectPickerDialog.tsx
const ProjectPickerDialog = ({ onSelectProject }) => {
  const { projects, loadProject } = useProjectManager();
  
  return (
    <Dialog>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Select Project</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          {projects.map(project => (
            <ProjectCard 
              key={project.id} 
              project={project}
              onSelect={() => onSelectProject(project)}
            />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};
```

#### **StorageLocationSelector**
```typescript
// src/components/projects/StorageLocationSelector.tsx
const StorageLocationSelector = ({ value, onChange }) => {
  const { driveConnected } = useGoogleAuth();
  
  return (
    <RadioGroup value={value} onValueChange={onChange}>
      <RadioGroupItem value="local">
        <HardDrive className="w-4 h-4" />
        Local Only
      </RadioGroupItem>
      <RadioGroupItem value="drive" disabled={!driveConnected}>
        <Cloud className="w-4 h-4" />
        Google Drive
      </RadioGroupItem>
      <RadioGroupItem value="both" disabled={!driveConnected}>
        <RefreshCw className="w-4 h-4" />
        Local + Drive Sync
      </RadioGroupItem>
    </RadioGroup>
  );
};
```

### **Step 7.3: Status Indicators**

#### **SyncStatusIndicator**
```typescript
// src/components/projects/SyncStatusIndicator.tsx
const SyncStatusIndicator = ({ project }) => {
  const getStatusInfo = () => {
    switch (project.storage.location) {
      case 'local':
        return { icon: HardDrive, color: 'blue', text: 'Local' };
      case 'drive':
        return { icon: Cloud, color: 'green', text: 'Drive' };
      case 'both':
        return { icon: RefreshCw, color: 'purple', text: 'Synced' };
    }
  };
  
  const { icon: Icon, color, text } = getStatusInfo();
  
  return (
    <Badge variant="outline" className={`text-${color}-600`}>
      <Icon className="w-3 h-3 mr-1" />
      {text}
    </Badge>
  );
};
```

---

## 📱 Phase 8: Integration with Existing Editor (Week 8)

### **Step 8.1: Update Navbar Component**

Modify `src/features/editor/navbar.tsx`:

```typescript
// Add these imports
import { useGoogleAuth } from '@/hooks/useGoogleAuth';
import { useProjectManager } from '@/hooks/useProjectManager';
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton';
import { UserDropdown } from '@/components/auth/UserDropdown';

// Replace hardcoded user: null with:
const { user, signOut, driveConnected } = useGoogleAuth();
const { currentProject } = useProjectManager();

// In the render section:
{user ? (
  <UserDropdown user={user} onSignOut={signOut} />
) : (
  <GoogleSignInButton />
)}
```

### **Step 8.2: Update Upload System**

Replace current upload logic in `src/features/editor/scene/empty.tsx`:

```typescript
import { useProjectManager } from '@/hooks/useProjectManager';
import { useGoogleAuth } from '@/hooks/useGoogleAuth';

const { addMediaFile, currentProject, createProject } = useProjectManager();
const { driveConnected } = useGoogleAuth();

const onSelectFiles = async (files: File[]) => {
  let project = currentProject;
  
  // Create project if none exists
  if (!project) {
    project = await createProject('Untitled Project', undefined, 'local');
  }
  
  // Add files to project
  for (const file of files) {
    try {
      const mediaFile = await addMediaFile(
        project.id, 
        file, 
        driveConnected ? 'both' : 'local'
      );
      
      // Dispatch to your existing video editor state
      dispatch(ADD_MEDIA, { payload: mediaFile });
    } catch (error) {
      console.error('Failed to add media file:', error);
    }
  }
};
```

### **Step 8.3: Project Selection Flow**

Add project management to the editor initialization:

```typescript
// src/features/editor/editor.tsx
const Editor = () => {
  const { currentProject, loadProject } = useProjectManager();
  
  useEffect(() => {
    // Show project picker if no current project
    if (!currentProject) {
      setShowProjectPicker(true);
    }
  }, [currentProject]);
  
  // Rest of your editor logic...
};
```

---

## 🔧 Phase 9: Advanced Features (Week 9)

### **Step 9.1: Project Templates**

```typescript
// src/data/projectTemplates.ts
export const PROJECT_TEMPLATES = [
  {
    id: 'youtube-video',
    name: 'YouTube Video',
    resolution: { width: 1920, height: 1080 },
    fps: 30,
    duration: 60000, // 1 minute
  },
  {
    id: 'instagram-story',
    name: 'Instagram Story',
    resolution: { width: 1080, height: 1920 },
    fps: 30,
    duration: 15000, // 15 seconds
  },
  // Add more templates...
];
```

### **Step 9.2: Export Integration**

Update export functionality to save to chosen storage:

```typescript
// In your export handler
const handleExport = async (quality: string) => {
  const { currentProject, saveProject } = useProjectManager();
  
  if (!currentProject) return;
  
  // Render video (your existing logic)
  const videoBlob = await renderVideo(currentProject, quality);
  
  // Save export based on storage preference
  if (currentProject.storage.location !== 'local') {
    await uploadExportToDrive(videoBlob, currentProject.id);
  }
  
  // Update project with export metadata
  await saveProject({
    ...currentProject,
    lastExport: {
      quality,
      timestamp: new Date().toISOString(),
      size: videoBlob.size,
    },
  });
};
```

### **Step 9.3: Offline Support**

```typescript
// src/hooks/useOfflineSync.ts
export const useOfflineSync = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingSync, setPendingSync] = useState<string[]>([]);
  
  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true);
      
      // Sync pending projects
      for (const projectId of pendingSync) {
        try {
          await syncProject(projectId);
          setPendingSync(prev => prev.filter(id => id !== projectId));
        } catch (error) {
          console.error('Sync failed:', error);
        }
      }
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', () => setIsOnline(false));
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', () => setIsOnline(false));
    };
  }, [pendingSync]);
  
  return { isOnline, pendingSync, addToPendingSync: setPendingSync };
};
```

---

## 🧪 Phase 10: Testing & Polish (Week 10)

### **Step 10.1: Error Handling**

Add comprehensive error boundaries and user feedback:

```typescript
// src/components/errors/StorageErrorBoundary.tsx
class StorageErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  
  render() {
    if (this.state.hasError) {
      return (
        <ErrorFallback 
          error={this.state.error}
          onRetry={() => this.setState({ hasError: false, error: null })}
        />
      );
    }
    
    return this.props.children;
  }
}
```

### **Step 10.2: Performance Optimization**

- Implement virtual scrolling for large project lists
- Add lazy loading for project thumbnails
- Optimize IndexedDB queries with proper indexing
- Add request debouncing for Drive API calls

### **Step 10.3: User Experience Polish**

- Add loading skeletons
- Implement toast notifications for actions
- Add keyboard shortcuts for common actions
- Improve accessibility with proper ARIA labels

---

## 📋 Implementation Checklist

### **Foundation** ✅
- [x] Type definitions
- [x] Browser capability detection
- [x] Project structure

### **Local Storage** ✅
- [x] File System Access API service
- [x] IndexedDB fallback service
- [x] Local project management

### **Authentication** ✅
- [x] Google OAuth service
- [x] Authentication hook
- [x] Session management

### **Google Drive** ✅
- [x] Drive API integration
- [x] Resumable uploads
- [x] Project sync

### **Hybrid Service** ✅
- [x] Main storage controller
- [x] Cross-platform compatibility
- [x] Sync resolution

### **UI Integration** 🔲
- [x] Project manager hook
- [x] Upload handler updates
- [ ] Authentication components
- [ ] Project management UI
- [ ] Storage location selector

### **Editor Integration** 🔲
- [ ] Update navbar with auth
- [ ] Replace upload system
- [ ] Project selection flow
- [ ] Export integration

### **Advanced Features** 🔲
- [ ] Project templates
- [ ] Offline sync
- [ ] Performance optimization
- [ ] Error handling
- [ ] User experience polish

---

## 🚀 Getting Started

1. **Environment Setup**
   ```bash
   # Add to .env file
   VITE_GOOGLE_CLIENT_ID=your_client_id
   VITE_GOOGLE_API_KEY=your_api_key
   ```

2. **Install Dependencies**
   ```bash
   # No additional dependencies needed - uses native browser APIs
   ```

3. **Begin Implementation**
   - Start with Phase 7 (UI Components)
   - Integrate with existing codebase gradually
   - Test each phase thoroughly

4. **Google Cloud Console Setup**
   - Enable Google Drive API
   - Create OAuth 2.0 credentials
   - Configure authorized domains

---

## 📚 Resources

- [File System Access API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API)
- [Google Drive API Documentation](https://developers.google.com/drive/api/v3/about-sdk)
- [Google Identity Services](https://developers.google.com/identity/gsi/web)
- [IndexedDB Guide](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)

---

## 🎯 Success Metrics

- ✅ Users can create and edit projects locally without authentication
- ✅ Optional Google sign-in for cloud backup
- ✅ Seamless file uploads to local storage or Drive
- ✅ Project sync between devices when authenticated
- ✅ Offline-first experience with optional online features
- ✅ No vendor lock-in - projects exportable in standard formats

**This plan provides a complete roadmap for implementing a production-ready hybrid storage system for your React video editor!**