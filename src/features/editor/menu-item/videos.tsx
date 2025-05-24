import Draggable from "@/components/shared/draggable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { VIDEOS } from "../data/video";
import { dispatch } from "@designcombo/events";
import { ADD_VIDEO } from "@designcombo/state";
import { generateId } from "@designcombo/timeline";
import { IVideo } from "@designcombo/types";
import React from "react";
import { useIsDraggingOverTimeline } from "../hooks/is-dragging-over-timeline";
import { useProject } from "@/contexts/ProjectContext";
import { UploadZone } from "@/components/ui/upload-zone";
import { Trash2 } from "lucide-react";

export const Videos = () => {
  const isDraggingOverTimeline = useIsDraggingOverTimeline();
  const { currentProject } = useProject();

  // Get uploaded videos from current project
  const projectVideos = React.useMemo(() => {
    if (!currentProject?.mediaFiles) return [];
    return currentProject.mediaFiles
      .filter(file => file.type === 'video')
      .map(file => ({
        id: file.id,
        details: { src: file.url },
        preview: file.url, // For videos, we'll use the URL as preview
        type: 'video' as const,
        name: file.name
      } as Partial<IVideo>));
  }, [currentProject?.mediaFiles]);

  const handleAddVideo = (payload: Partial<IVideo>) => {
    // payload.details.src = "https://cdn.designcombo.dev/videos/timer-20s.mp4";
    dispatch(ADD_VIDEO, {
      payload,
      options: {
        resourceId: "main",
        scaleMode: "fit",
      },
    });
  };

  return (
    <div className="flex flex-1 flex-col">
      <div className="text-text-primary flex h-12 flex-none items-center px-4 text-sm font-medium">
        Videos
      </div>
      <ScrollArea>
        <div className="flex flex-col px-2">
          {projectVideos.length === 0 ? (
            <UploadZone acceptedTypes="video" />
          ) : (
            <>
              {projectVideos.map((video, index) => {
                return (
                  <VideoItem
                    key={video.id || index}
                    video={video}
                    shouldDisplayPreview={!isDraggingOverTimeline}
                    handleAddVideo={handleAddVideo}
                  />
                );
              })}
              <UploadZone acceptedTypes="video" className="mt-4" />
            </>
          )}
        </div>
      </ScrollArea>
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
            } as any)
          }
          className="flex items-center gap-3 cursor-pointer flex-1"
        >
          <div className="w-12 h-12 rounded-md overflow-hidden flex-shrink-0">
            <video
              src={video.preview}
              className="w-full h-full object-cover"
              muted
              playsInline
              preload="metadata"
              onLoadedMetadata={(e) => {
                // Set the video to show the first frame as thumbnail
                e.currentTarget.currentTime = 1;
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
