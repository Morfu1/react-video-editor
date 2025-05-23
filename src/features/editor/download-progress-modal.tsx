import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useDownloadState } from "./store/use-download-state";
import { Button } from "@/components/ui/button";
import { AlertCircle, ChevronDown, CircleCheckIcon, Clock, HardDrive, XIcon } from "lucide-react";
import { DialogDescription, DialogTitle } from "@radix-ui/react-dialog";
import { useState, useEffect } from "react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

// Helper function to format time remaining
const formatTimeRemaining = (ms: number): string => {
  if (!ms) return 'Calculating...';
  
  const seconds = Math.floor(ms / 1000);
  
  if (seconds < 60) {
    return `${seconds} seconds`;
  }
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  
  if (minutes < 60) {
    return `${minutes} min ${remainingSeconds} sec`;
  }
  
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  
  return `${hours} hr ${remainingMinutes} min`;
};
import { Progress } from "@/components/ui/progress";

const DownloadProgressModal = () => {
  const {
    progress,
    displayProgressModal,
    output,
    exporting,
    actions,
    quality,
    exportType,
    renderPhase,
    timeRemaining,
    memoryUsage,
    error
  } = useDownloadState();
  
  const isCompleted = progress === 100;
  const [savePath, setSavePath] = useState<string>("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [pathSelected, setPathSelected] = useState(false);

  // Initialize the default path when quality changes
  useEffect(() => {
    if (!savePath) {
      const timestamp = new Date().getTime();
      const defaultPath = `video-export-${quality.replace(/[()]/g, '')}-${timestamp}.mp4`;
      setSavePath(defaultPath);
      setPathSelected(true); // Auto-select default path
      actions.setSavePath(defaultPath);
    }
  }, [quality, savePath, actions]);


  
  // Handle manual path editing
  const handlePathChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newPath = e.target.value;
    setSavePath(newPath);
    actions.setSavePath(newPath);
    
    // If they've edited the path, consider it selected
    if (newPath.trim() !== "") {
      setPathSelected(true);
    } else {
      setPathSelected(false);
    }
  };

  // Function to download the completed video
  const handleSaveVideo = async () => {
    try {
      setSaveError(null);
      
      if (!savePath || savePath.trim() === "") {
        setSaveError("Please enter a valid filename");
        return;
      }
      
      // Get the render job ID and download the video
      const { renderJobId } = useDownloadState.getState();
      if (!renderJobId) {
        setSaveError("No video to download");
        return;
      }
      
      // Trigger download from server
      const downloadUrl = `http://localhost:3031/api/render/download/${renderJobId}`;
      
      // Use the download utility to handle the download
      const { download } = await import('@/utils/download');
      await download(downloadUrl, savePath);
      
      // Close modal without confirmation dialog
      handleClose();
    } catch (error) {
      console.error('Download video error:', error);
      setSaveError(error instanceof Error ? error.message : 'Failed to download video');
    }
  };

  // Function to start the rendering process
  const handleStartRender = () => {
    if (!savePath || savePath.trim() === "") {
      setSaveError("Please enter a valid save location");
      return;
    }
    
    // Make sure path ends with .mp4 for MP4 format
    let finalPath = savePath;
    if (exportType === "mp4" && !finalPath.toLowerCase().endsWith(".mp4")) {
      finalPath = `${finalPath}.mp4`;
      setSavePath(finalPath);
      actions.setSavePath(finalPath);
    }
    
    // Start the export process with the validated path
    actions.startExport();
  };

  // Function to close the modal after rendering is complete
  const handleClose = () => {
    // Reset state so user can export again
    actions.setDisplayProgressModal(false);
    actions.setProgress(0);
    actions.setExporting(false);
    // Don't reset the save path so it's remembered for next time
  };
  
  // Reset the export state when the modal is closed with the X button
  useEffect(() => {
    if (!displayProgressModal) {
      // Reset progress if the modal was closed during or after export
      if (progress > 0) {
        actions.setProgress(0);
        actions.setExporting(false);
      }
    }
  }, [displayProgressModal, progress, actions]);

  const handleCancel = async () => {
    // Use our new cancelExport method
    await actions.cancelExport();
  };

  return (
    <Dialog
      open={displayProgressModal}
      onOpenChange={(open) => {
        // Only allow closing if not actively exporting
        if (!exporting || isCompleted) {
          actions.setDisplayProgressModal(open);
        }
      }}
    >
      <DialogContent className="flex h-[627px] flex-col gap-0 bg-background p-0 sm:max-w-[844px] border border-border rounded-lg">
        <DialogTitle className="hidden" />
        <DialogDescription className="hidden" />
        {/* Remove the custom X icon to fix the duplicate X issue */}
        <div className="flex h-16 items-center border-b px-4 font-medium">
          Download
        </div>
        {saveError && (
          <div className="absolute top-16 left-0 right-0 bg-red-500/10 text-red-500 p-2 text-center">
            {saveError}
          </div>
        )}
        
        {!exporting && progress === 0 ? (
          // Step 1: Select save location
          <div className="flex flex-1 flex-col items-center justify-center gap-6">
            <h2 className="text-xl font-bold">Render Video</h2>
            <p className="text-muted-foreground text-center">
              Choose quality and location before rendering
            </p>
            
            <div className="flex flex-col gap-5 w-96">
              <div className="flex flex-col gap-1">
                <label className="text-sm text-muted-foreground">Format</label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button className="w-full justify-between bg-background" variant="outline">
                      <div>{exportType.toUpperCase()}</div>
                      <ChevronDown width={16} />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="bg-background z-[9001] w-full">
                    <DropdownMenuItem
                      onClick={() => actions.setExportType("mp4")}
                    >
                      MP4
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => actions.setExportType("json")}
                    >
                      JSON
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              
              <div className="flex flex-col gap-1">
                <label className="text-sm text-muted-foreground">Quality</label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button className="w-full justify-between bg-background" variant="outline">
                      <div>{quality}</div>
                      <ChevronDown width={16} />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="bg-background z-[9001] w-full">
                    <DropdownMenuItem
                      onClick={() => actions.setQuality("Full HD (1080p)")}
                    >
                      Full HD (1080p)
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => actions.setQuality("4K (2160p)")}
                    >
                      4K (2160p)
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              
              <div className="flex flex-col gap-1">
                <label className="text-sm text-muted-foreground">Save Filename</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={savePath}
                    onChange={handlePathChange}
                    placeholder="Enter filename for your video"
                    className="flex-1 px-3 py-2 text-sm border border-border rounded-md bg-background"
                  />

                </div>
                <div className="text-xs text-blue-500 mt-1">
                Note: Video will be downloaded to your Downloads folder with this filename
                </div>
                {saveError && (
                  <div className="text-xs text-red-500 mt-1">
                    {saveError}
                  </div>
                )}
              </div>
            </div>
            
            <Button
              onClick={handleStartRender}
              className="px-6 py-2 mt-5"
              size="lg"
              disabled={exporting || !pathSelected}
            >
              Start Rendering
            </Button>
          </div>
        ) : isCompleted ? (
          // Step 3: Rendering complete - styled to match screenshot
          <div className="flex flex-1 flex-col items-center justify-center">
            <div className="text-green-500 h-16 w-16 flex items-center justify-center mb-3">
              <CircleCheckIcon size={56} />
            </div>
            
            <h2 className="text-2xl font-bold mb-2">Rendering Complete</h2>
            
            <p className="text-center text-muted-foreground mb-6">
              Your {quality} video has been rendered successfully.
            </p>
            
            <div className="bg-zinc-800/50 p-3 rounded-md mb-8 max-w-md">
              <p className="text-center font-medium mb-1">Video rendered successfully!</p>
              <p className="text-center text-xs text-muted-foreground mt-2">
                Enter filename to download video to your Downloads folder
              </p>
            </div>
            
            <div className="flex flex-col gap-1 w-full max-w-md mb-6">
              <label className="text-sm text-muted-foreground">Download Filename</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={savePath}
                  onChange={handlePathChange}
                  placeholder="Enter filename (e.g., my-video.mp4)"
                  className="flex-1 px-3 py-2 text-sm border border-border rounded-md bg-background"
                />
                
              </div>
              {saveError && (
                <div className="text-xs text-red-500 mt-1">
                  {saveError}
                </div>
              )}
            </div>
            
            <div className="flex gap-3">
              <Button
                onClick={handleSaveVideo}
                className="px-8 py-2"
                size="lg"
                disabled={!savePath}
              >
                Download Video
              </Button>
              <Button
                onClick={handleClose}
                variant="outline"
                className="px-8 py-2"
                size="lg"
              >
                Close
              </Button>
            </div>
          </div>
        ) : error ? (
          // Error state
          <div className="flex flex-1 flex-col items-center justify-center gap-4">
            <div className="text-red-500 h-16 w-16 flex items-center justify-center mb-3">
              <AlertCircle size={56} />
            </div>
            
            <h2 className="text-2xl font-bold mb-2 text-red-500">Rendering Failed</h2>
            
            <p className="text-center text-muted-foreground mb-4">
              There was an error rendering your video.
            </p>
            
            <div className="bg-red-900/20 border border-red-500/30 p-4 rounded-md mb-6 max-w-md">
              <p className="text-center text-red-400 break-all px-3">
                {error}
              </p>
            </div>
            
            <div className="flex gap-4">
              <Button
                onClick={handleClose}
                variant="outline"
              >
                Close
              </Button>
              <Button
                onClick={handleStartRender}
                className="px-6"
              >
                Try Again
              </Button>
            </div>
          </div>
        ) : (
          // Rendering in progress with enhanced progress information
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6">
            {/* Main progress display */}
            <div className="text-5xl font-semibold">
              {Math.floor(progress)}%
            </div>
            
            {/* Progress bar */}
            <div className="w-full max-w-md mb-2">
              <Progress value={progress} className="h-2" />
            </div>
            
            {/* Phase information */}
            <div className="text-xl font-bold mb-2">
              {renderPhase === 'extraction' && 'Extracting Frames...'}
              {renderPhase === 'encoding' && 'Encoding Video...'}
              {!renderPhase && 'Rendering'} {quality} Video
            </div>
            
            {/* Detailed status */}
            <div className="flex flex-col gap-3 text-center text-zinc-300 max-w-md mb-4">
              {/* Time remaining */}
              {timeRemaining && (
                <div className="flex items-center justify-center gap-2">
                  <Clock className="w-4 h-4 text-zinc-500" />
                  <span>
                    Estimated time remaining: {formatTimeRemaining(timeRemaining)}
                  </span>
                </div>
              )}
              
              {/* Memory usage */}
              {memoryUsage && (
                <div className="flex items-center justify-center gap-2">
                  <HardDrive className="w-4 h-4 text-zinc-500" />
                  <span>
                    Memory: {Math.round(memoryUsage.used)}MB / {Math.round(memoryUsage.total)}MB
                    ({memoryUsage.percentage}%)
                  </span>
                </div>
              )}
              
              {/* Output info */}
              {savePath && (
                <div className="text-zinc-400 break-all text-xs mt-1 mb-1">
                  Will download as: {savePath}
                </div>
              )}
              
              <div className="text-zinc-500 text-sm mt-2">
                Rendering with FFmpeg for optimal quality.
                Closing the browser will not cancel the rendering.
              </div>
            </div>
            
            {/* Cancel button */}
            <Button
              variant="outline"
              onClick={() => actions.cancelExport()}
              className="mt-2"
            >
              Cancel
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default DownloadProgressModal;
