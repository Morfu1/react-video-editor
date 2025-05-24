import Draggable from "@/components/shared/draggable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AUDIOS } from "../data/audio";
import { dispatch } from "@designcombo/events";
import { ADD_AUDIO } from "@designcombo/state";
import { IAudio } from "@designcombo/types";
import { Music } from "lucide-react";
import { useIsDraggingOverTimeline } from "../hooks/is-dragging-over-timeline";
import React from "react";
import { generateId } from "@designcombo/timeline";
import { useProject } from "@/contexts/ProjectContext";
import { UploadZone } from "@/components/ui/upload-zone";
import { Trash2 } from "lucide-react";

export const Audios = () => {
  const isDraggingOverTimeline = useIsDraggingOverTimeline();
  const { currentProject } = useProject();

  // Get uploaded audio files from current project
  const projectAudios = React.useMemo(() => {
    if (!currentProject?.mediaFiles) return [];
    return currentProject.mediaFiles
      .filter(file => file.type === 'audio')
      .map(file => ({
        id: file.id,
        details: { src: file.url },
        name: file.name,
        type: 'audio' as const,
        metadata: {
          author: 'Uploaded Audio'
        }
      }));
  }, [currentProject?.mediaFiles]);

  const handleAddAudio = (payload: Partial<IAudio>) => {
    payload.id = generateId();
    dispatch(ADD_AUDIO, {
      payload,
      options: {},
    });
  };

  return (
    <div className="flex flex-1 flex-col">
      <div className="text-text-primary flex h-12 flex-none items-center px-4 text-sm font-medium">
        Audios
      </div>
      <ScrollArea>
        <div className="flex flex-col px-2">
          {projectAudios.length === 0 ? (
            <UploadZone acceptedTypes="audio" />
          ) : (
            <>
              {projectAudios.map((audio, index) => {
                return (
                  <AudioItem
                    shouldDisplayPreview={!isDraggingOverTimeline}
                    handleAddAudio={handleAddAudio}
                    audio={audio}
                    key={audio.id || index}
                  />
                );
              })}
              <UploadZone acceptedTypes="audio" className="mt-4" />
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

const AudioItem = ({
  handleAddAudio,
  audio,
  shouldDisplayPreview,
}: {
  handleAddAudio: (payload: Partial<IAudio>) => void;
  audio: Partial<IAudio>;
  shouldDisplayPreview: boolean;
}) => {
  const { currentProject, removeMediaFileFromProject } = useProject();

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (currentProject && audio.id) {
      try {
        await removeMediaFileFromProject(currentProject.id, audio.id);
      } catch (error) {
        console.error('Failed to remove audio:', error);
      }
    }
  };
  const style = React.useMemo(
    () => ({
      backgroundImage: `url(https://cdn.designcombo.dev/thumbnails/music-preview.png)`,
      backgroundSize: "cover",
      width: "70px",
      height: "70px",
    }),
    [],
  );

  return (
    <div className="flex items-center gap-2 p-2 rounded-md hover:bg-gray-800 group">
      <Draggable
        data={audio}
        renderCustomPreview={<div style={style} />}
        shouldDisplayPreview={shouldDisplayPreview}
      >
        <div
          draggable={false}
          onClick={() => handleAddAudio(audio)}
          className="flex items-center gap-3 cursor-pointer flex-1"
        >
          <div className="flex h-12 w-12 items-center justify-center bg-zinc-800 rounded-md">
            <Music width={16} />
          </div>
          <div className="flex flex-col justify-center flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{audio.name}</p>
            <p className="text-xs text-gray-400">{audio.metadata?.author || 'Uploaded Audio'}</p>
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
