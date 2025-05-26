import useStore from "../store/use-store";
import { useEffect, useRef, useState } from "react";
import { Droppable } from "@/components/ui/droppable";
import { PlusIcon } from "lucide-react";
import { DroppableArea } from "./droppable";
import { useProject } from "@/contexts/ProjectContext";
import { useGoogleAuth } from "@/hooks/useGoogleAuth";
import { dispatch } from "@designcombo/events";
import { generateId } from "@designcombo/timeline";

const SceneEmpty = () => {
  const [isLoading, setIsLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [desiredSize, setDesiredSize] = useState({ width: 0, height: 0 });
  const { size } = useStore();
  const projectContext = useProject();
  const { addMediaFile, currentProject, createProject, setCurrentProject } = projectContext;
  const { driveConnected } = useGoogleAuth();

  // Store the current project in a ref to avoid stale closure
  const currentProjectRef = useRef(currentProject);
  currentProjectRef.current = currentProject;

  // Debug removed for cleaner console

  useEffect(() => {
    const container = containerRef.current!;
    const PADDING = 96;
    const containerHeight = container.clientHeight - PADDING;
    const containerWidth = container.clientWidth - PADDING;
    const { width, height } = size;

    const desiredZoom = Math.min(
      containerWidth / width,
      containerHeight / height,
    );
    setDesiredSize({
      width: width * desiredZoom,
      height: height * desiredZoom,
    });
    setIsLoading(false);
  }, [size]);

  const onSelectFiles = async (files: File[]) => {
    console.log('onSelectFiles called with:', { 
      files, 
      fileCount: files.length,
      currentProject: currentProject?.id,
      currentProjectName: currentProject?.name,
      addMediaFileAvailable: !!addMediaFile 
    });
    
    try {
      // Use the ref to get the current project value (avoids stale closure)
      const project = currentProjectRef.current;
      
      console.log('Current project state (from ref):', {
        exists: !!project,
        id: project?.id,
        name: project?.name,
        mediaFilesCount: project?.mediaFiles?.length
      });
      
      console.log('Comparison - direct vs ref:', {
        directCurrentProject: currentProject?.id,
        refCurrentProject: currentProjectRef.current?.id,
        contextCurrentProject: projectContext.currentProject?.id
      });
      
      // Create project if none exists
      if (!project) {
        console.log('No current project found in ref either');
        alert('No project selected. Please select a project first.');
        return;
      }
      
      // Add files to project
      for (const file of files) {
        try {
          console.log('Processing file:', file.name, file.type, file.size);
          const mediaFile = await addMediaFile(
            project.id, 
            file, 
            driveConnected ? 'both' : 'local'
          );
          console.log('Media file added to project:', mediaFile);
          

          
          // Determine file type from MIME type
          let fileType: 'video' | 'image' | 'audio' = 'image'; // default
          if (file.type.startsWith('video/')) {
            fileType = 'video';
          } else if (file.type.startsWith('audio/')) {
            fileType = 'audio';
          } else if (file.type.startsWith('image/')) {
            fileType = 'image';
          }

          // File uploaded successfully! 
          // It will appear in the Photos/Videos/Audios panel
          // User can then drag it to timeline manually
          console.log('File uploaded to project:', { 
            originalFileType: file.type,
            detectedType: fileType,
            mediaFile: mediaFile
          });
        } catch (error) {
          console.error('Failed to add media file:', error);
        }
      }
    } catch (error) {
      console.error('Failed to handle file upload:', error);
    }
  };

  return (
    <div ref={containerRef} className="absolute z-50 flex h-full w-full flex-1">
      {!isLoading ? (
        <Droppable
          maxFileCount={4}
          maxSize={100 * 1024 * 1024} // 100MB for video files
          disabled={false}
          onValueChange={onSelectFiles}
          className="h-full w-full flex-1 bg-background"
          accept={{
            'video/*': ['.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm'],
            'image/*': ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'],
            'audio/*': ['.mp3', '.wav', '.aac', '.ogg', '.flac']
          }}
          multiple={true}
        >
          <DroppableArea
            onDragStateChange={setIsDraggingOver}
            className={`absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 transform items-center justify-center border border-dashed text-center transition-colors duration-200 ease-in-out ${
              isDraggingOver ? "border-white bg-white/10" : "border-white/15"
            }`}
            style={{
              width: desiredSize.width,
              height: desiredSize.height,
            }}
          >
            <div className="flex flex-col items-center justify-center gap-4 pb-12">
              <div className="hover:bg-primary-dark cursor-pointer rounded-md border bg-primary p-2 text-secondary transition-colors duration-200">
                <PlusIcon className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="flex flex-col gap-px">
                <p className="text-sm text-muted-foreground">Click to upload</p>
                <p className="text-xs text-muted-foreground/70">
                  Or drag and drop files here
                </p>
              </div>
            </div>
          </DroppableArea>
        </Droppable>
      ) : (
        <div className="flex flex-1 items-center justify-center bg-background-subtle text-sm text-muted-foreground">
          Loading...
        </div>
      )}
    </div>
  );
};

export default SceneEmpty;
