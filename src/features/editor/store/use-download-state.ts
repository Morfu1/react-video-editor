import { IDesign } from "@designcombo/types";
import { create } from "zustand";
import io from 'socket.io-client';

interface Output {
  url: string;
  type: string;
}

interface MemoryUsage {
  used: number;
  total: number;
  percentage: number;
}

interface DownloadState {
  projectId: string;
  exporting: boolean;
  exportType: "json" | "mp4";
  progress: number;
  output?: Output;
  payload?: IDesign;
  displayProgressModal: boolean;
  quality: string;
  savePath?: string;
  renderPhase: string;
  renderJobId: string;
  timeRemaining: number | null;
  memoryUsage: MemoryUsage | null;
  error: string | null;
  socketConnected: boolean;
  actions: {
    setProjectId: (projectId: string) => void;
    setExporting: (exporting: boolean) => void;
    setExportType: (exportType: "json" | "mp4") => void;
    setProgress: (progress: number) => void;
    setState: (state: Partial<DownloadState>) => void;
    setOutput: (output: Output) => void;
    startExport: () => void;
    setDisplayProgressModal: (displayProgressModal: boolean) => void;
    setQuality: (quality: string) => void;
    setSavePath: (savePath: string) => void;
    setRenderPhase: (renderPhase: string) => void;
    setRenderJobId: (renderJobId: string) => void;
    setError: (error: string | null) => void;
    setSocketConnected: (socketConnected: boolean) => void;
    connectSocket: (jobId: string) => any;
    cancelExport: () => Promise<void>;
    saveVideoToPath: (outputPath: string) => Promise<any>;
  };
}

export const useDownloadState = create<DownloadState>((set, get) => ({
  projectId: "",
  exporting: false,
  exportType: "mp4",
  progress: 0,
  displayProgressModal: false,
  quality: "Full HD (1080p)",
  savePath: undefined,
  output: undefined,
  renderPhase: "",
  renderJobId: "",
  timeRemaining: null,
  memoryUsage: null,
  error: null,
  socketConnected: false,
  actions: {
    setProjectId: (projectId) => set({ projectId }),
    setExporting: (exporting) => set({ exporting }),
    setExportType: (exportType) => set({ exportType }),
    setProgress: (progress) => set({ progress }),
    setState: (state) => set({ ...state }),
    setOutput: (output) => set({ output }),
    setDisplayProgressModal: (displayProgressModal) =>
      set({ displayProgressModal }),
    setQuality: (quality) => set({ quality }),
    setSavePath: (savePath) => set({ savePath }),
    setRenderPhase: (renderPhase) => set({ renderPhase }),
    setRenderJobId: (renderJobId) => set({ renderJobId }),
    setError: (error) => set({ error }),
    setSocketConnected: (socketConnected) => set({ socketConnected }),
    
    // Connect to Socket.IO for real-time updates
    connectSocket: (jobId) => {
      try {
        // Create socket connection to rendering server
        const socket = io('http://localhost:3031');
        
        // Handle socket connection
        socket.on('connect', () => {
          console.log('Socket connected');
          set({ socketConnected: true });
        });
        
        // Handle socket disconnection
        socket.on('disconnect', () => {
          console.log('Socket disconnected');
          set({ socketConnected: false });
        });
        
        // Listen for job progress updates
        socket.on(`job-progress-${jobId}`, (data) => {
          console.log('Job progress update:', data);
          
          set({
            progress: data.progress,
            renderPhase: data.phase,
            timeRemaining: data.timeRemaining,
            memoryUsage: data.memoryUsage
          });
          
          // If job completed, update output
          if (data.phase === 'completed') {
            set({
              exporting: false,
              output: {
                url: data.outputPath,
                type: get().exportType
              }
            });
          }
          
          // If job failed, set error
          if (data.phase === 'failed') {
            set({
              exporting: false,
              error: data.error
            });
          }
        });
        
        return socket;
      } catch (error) {
        console.error('Socket connection error:', error);
        return null;
      }
    },
    
    // Start the export process
    startExport: async () => {
      try {
        // Set exporting to true at the start
        set({ exporting: true, displayProgressModal: true, error: null });

        // Get design data and settings
        const { payload, quality, savePath } = get();

        if (!payload) throw new Error("Payload is not defined");
        
        // Prepare export options
        const exportOptions = {
          design: payload,
          options: {
            fps: 30,
            size: payload.size,
            format: get().exportType,
            quality,
            savePath: savePath || `video-export-${quality.replace(/[()]/g, '')}-${Date.now()}.mp4`
          }
        };
        
        console.log('Starting export with options:', exportOptions);
        
        // Start the rendering process by calling our server API
        const response = await fetch('http://localhost:3031/api/render/start', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(exportOptions)
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to start rendering');
        }
        
        const jobInfo = await response.json();
        const jobId = jobInfo.jobId;
        
        console.log('Render job started:', jobInfo);
        
        // Store job ID
        set({ renderJobId: jobId });
        
        // Connect to Socket.IO for real-time progress updates
        const socket = get().actions.connectSocket(jobId);
        
        // Fall back to polling if socket connection fails
        if (!socket || !get().socketConnected) {
          console.log('Falling back to status polling');
          
          // Start polling for status updates
          const checkStatus = async () => {
            try {
              const statusResponse = await fetch(`http://localhost:3031/api/render/status/${jobId}`);
              
              if (!statusResponse.ok) {
                throw new Error('Failed to check render status');
              }
              
              const statusInfo = await statusResponse.json();
              
              set({
                progress: statusInfo.progress,
                renderPhase: statusInfo.phase
              });
              
              if (statusInfo.status === 'completed') {
                set({
                  exporting: false,
                  output: {
                    url: statusInfo.outputPath,
                    type: get().exportType
                  }
                });
              } else if (statusInfo.status === 'error') {
                set({
                  exporting: false,
                  error: statusInfo.error
                });
              } else {
                // Continue polling
                setTimeout(checkStatus, 1000);
              }
            } catch (statusError) {
              console.error('Status check error:', statusError);
              set({ exporting: false, error: statusError.message });
            }
          };
          
          // Start checking status
          checkStatus();
        }
      } catch (error) {
        console.error('Export error:', error);
        set({ exporting: false, error: error.message });
      }
    },
    
    // Cancel the export process
    cancelExport: async () => {
      try {
        const { renderJobId } = get();
        
        if (renderJobId) {
          // Send cancellation request to server
          await fetch(`http://localhost:3031/api/render/cancel/${renderJobId}`, {
            method: 'POST'
          });
        }
        
        // Reset export state
        set({
          exporting: false,
          progress: 0,
          renderJobId: '',
          renderPhase: '',
          error: null
        });
      } catch (error) {
        console.error('Cancel error:', error);
        // Reset export state anyway
        set({ exporting: false, progress: 0 });
      }
    },
    
    // Save completed video to user-specified path
    saveVideoToPath: async (outputPath: string) => {
      try {
        const { renderJobId } = get();
        
        if (!renderJobId) {
          throw new Error('No render job ID available');
        }
        
        if (!outputPath) {
          throw new Error('Output path is required');
        }
        
        // Call the save API
        const response = await fetch(`http://localhost:3031/api/render/save/${renderJobId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ outputPath })
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to save video');
        }
        
        const result = await response.json();
        console.log('Video saved successfully:', result);
        
        // Clear the render job since it's now saved and cleaned up
        set({
          renderJobId: '',
          output: null
        });
        
        return result;
      } catch (error) {
        console.error('Save video error:', error);
        throw error;
      }
    }
  },
}));
