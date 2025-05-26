import Draggable from "@/components/shared/draggable";
import { ScrollArea } from "@/components/ui/scroll-area";

import { dispatch } from "@designcombo/events";
import { ADD_ITEMS } from "@designcombo/state";
import { generateId } from "@designcombo/timeline";
import { IVideo } from "@designcombo/types";
import React from "react";
import { useIsDraggingOverTimeline } from "../hooks/is-dragging-over-timeline";
import { useProject } from "@/contexts/ProjectContext";
import useStore from "../store/use-store";
import { SimpleUploadButton } from "@/components/ui/simple-upload-button";
import { useGoogleAuth } from "@/hooks/useGoogleAuth";
import { Trash2 } from "lucide-react";

export const Videos = () => {
  const isDraggingOverTimeline = useIsDraggingOverTimeline();
  const { currentProject, addMediaFile } = useProject();
  const { driveConnected } = useGoogleAuth();
  const { size } = useStore();

  // Get uploaded videos from current project
  const projectVideos = React.useMemo(() => {
    if (!currentProject?.mediaFiles) return [];
    const videoFiles = currentProject.mediaFiles.filter(file => file.type === 'video');
    console.log('Video files in project:', videoFiles.length, videoFiles.map(f => f.name));
    return videoFiles.map(file => ({
      id: file.id,
      details: { src: file.url },
      preview: file.url, // For videos, we'll use the URL as preview
      type: 'video' as const,
      name: file.name
    } as Partial<IVideo>));
  }, [currentProject?.mediaFiles]);

  const handleAddVideo = (payload: Partial<IVideo>) => {
    const id = generateId();
    dispatch(ADD_ITEMS, {
      payload: {
        trackItems: [
          {
            id,
            type: "video",
            display: {
              from: 0,
              to: 5000,
            },
            details: {
              src: payload.details?.src,
            },
            metadata: {},
          },
        ],
      },
      options: {
        scaleMode: "fit",
        resourceId: "main",
      },
    });
  };

  const handleFileUpload = async (files: File[]) => {
    if (!currentProject) {
      alert('No project selected. Please select a project first.');
      return;
    }

    try {
      // Filter out duplicate files based on name and size
      const existingFiles = currentProject.mediaFiles || [];
      const newFiles = files.filter(file => {
        const isDuplicate = existingFiles.some(existing => 
          existing.name === file.name && existing.size === file.size
        );
        if (isDuplicate) {
          console.log('Skipping duplicate file:', file.name);
        }
        return !isDuplicate;
      });

      if (newFiles.length === 0) {
        console.log('No new files to upload (all duplicates)');
        return;
      }

      // Add files to project sequentially to avoid race conditions
      console.log(`Processing ${newFiles.length} video files sequentially`);
      for (const [index, file] of newFiles.entries()) {
        try {
          console.log(`Processing video file ${index + 1}/${newFiles.length}:`, file.name, file.type, file.size);
          await addMediaFile(
            currentProject.id, 
            file, 
            driveConnected ? 'both' : 'local'
          );
          console.log(`Video file ${index + 1} uploaded successfully:`, file.name);
        } catch (error) {
          console.error(`Failed to add video file ${index + 1}:`, error);
        }
      }
      console.log('All video files processed successfully');
    } catch (error) {
      console.error('Failed to handle file upload:', error);
    }
  };

  return (
    <div className="flex flex-1 flex-col h-full">
      <div className="text-text-primary flex h-12 flex-none items-center px-4 text-sm font-medium">
        Videos
      </div>
      <div className="flex-1 min-h-0 flex flex-col">
        <div className="px-2 py-2 border-b border-gray-700">
          <SimpleUploadButton 
            acceptedTypes="video" 
            onFilesSelected={handleFileUpload}
          />
        </div>
        <ScrollArea className="flex-1">
          <div className="flex flex-col px-2 space-y-2 py-2">
            {projectVideos.map((video, index) => {
              console.log(`Rendering video ${index + 1}:`, video.name);
              return (
                <VideoItem
                  key={video.id || index}
                  video={video}
                  shouldDisplayPreview={!isDraggingOverTimeline}
                  handleAddVideo={handleAddVideo}
                />
              );
            })}
            {projectVideos.length === 0 && (
              <div className="text-center text-gray-400 py-8">
                No videos uploaded yet
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
};

const VideoItem = ({
  handleAddVideo,
  video,
  shouldDisplayPreview,
}: {
  handleAddVideo: (payload: Partial<IVideo>) => void;
  video: Partial<IVideo>;
  shouldDisplayPreview: boolean;
}) => {
  const { currentProject, removeMediaFileFromProject } = useProject();

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (currentProject && video.id) {
      try {
        await removeMediaFileFromProject(currentProject.id, video.id);
      } catch (error) {
        console.error('Failed to remove video:', error);
      }
    }
  };
  const style = React.useMemo(
    () => ({
      backgroundImage: `url(${video.preview})`,
      backgroundSize: "cover",
      width: "80px",
      height: "80px",
    }),
    [video.preview],
  );

  return (
    <div className="flex items-center gap-2 p-2 rounded-md hover:bg-gray-800 group">
      <Draggable
        data={{
          ...video,
          metadata: {
            previewUrl: video.preview,
          },
        }}
        renderCustomPreview={<div style={style} className="draggable" />}
        shouldDisplayPreview={shouldDisplayPreview}
      >
        <div
          onClick={() =>
            handleAddVideo({
              id: generateId(),
              details: {
                src: video.details!.src,
              },
              metadata: {
                previewUrl: video.preview,
              },
            } as unknown as Partial<IVideo>)
          }
          className="flex items-center gap-3 cursor-pointer flex-1"
        >
          <div className="w-12 h-12 rounded-md overflow-hidden flex-shrink-0 bg-gray-700">
            <video
              src={video.preview}
              className="w-full h-full object-cover"
              muted
              playsInline
              preload="metadata"
              poster=""
              onLoadedMetadata={(e) => {
                // Set the video to show the first frame as thumbnail
                e.currentTarget.currentTime = 0.5;
              }}
              onError={(e) => {
                console.error('Video thumbnail load error:', e);
                // Add fallback styling or placeholder
                e.currentTarget.style.display = 'none';
                const placeholder = document.createElement('div');
                placeholder.className = 'w-full h-full bg-gray-600 flex items-center justify-center text-xs text-gray-300';
                placeholder.textContent = 'Video';
                e.currentTarget.parentElement?.appendChild(placeholder);
              }}
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">
              {video.name || 'Untitled Video'}
            </p>
            <p className="text-xs text-gray-400">Uploaded Video</p>
          </div>
        </div>
      </Draggable>
      
      <button
        onClick={handleDelete}
        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-600 rounded transition-all"
      >
        <Trash2 className="w-4 h-4 text-gray-400 hover:text-white" />
      </button>
    </div>
  );
};
