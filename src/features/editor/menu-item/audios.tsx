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
import { SimpleUploadButton } from "@/components/ui/simple-upload-button";
import { useGoogleAuth } from "@/hooks/useGoogleAuth";
import { Trash2 } from "lucide-react";

export const Audios = () => {
  const isDraggingOverTimeline = useIsDraggingOverTimeline();
  const { currentProject, addMediaFile } = useProject();
  const { driveConnected } = useGoogleAuth();

  // Get uploaded audio files from current project
  const projectAudios = React.useMemo(() => {
    if (!currentProject?.mediaFiles) return [];
    const audioFiles = currentProject.mediaFiles.filter(file => file.type === 'audio');
    console.log('Audio files in project:', audioFiles.length, audioFiles.map(f => f.name));
    return audioFiles.map(file => ({
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
      console.log(`Processing ${newFiles.length} files sequentially`);
      for (const [index, file] of newFiles.entries()) {
        try {
          console.log(`Processing file ${index + 1}/${newFiles.length}:`, file.name, file.type, file.size);
          await addMediaFile(
            currentProject.id, 
            file, 
            driveConnected ? 'both' : 'local'
          );
          console.log(`File ${index + 1} uploaded successfully:`, file.name);
        } catch (error) {
          console.error(`Failed to add media file ${index + 1}:`, error);
        }
      }
      console.log('All files processed successfully');
    } catch (error) {
      console.error('Failed to handle file upload:', error);
    }
  };

  return (
    <div className="flex flex-1 flex-col h-full">
      <div className="text-text-primary flex h-12 flex-none items-center px-4 text-sm font-medium">
        Audios
      </div>
      <div className="flex-1 min-h-0 flex flex-col">
        <div className="px-2 py-2 border-b border-gray-700">
          <SimpleUploadButton 
            acceptedTypes="audio" 
            onFilesSelected={handleFileUpload}
          />
        </div>
        <ScrollArea className="flex-1">
          <div className="flex flex-col px-2 space-y-2 py-2">
            {projectAudios.map((audio, index) => {
              console.log(`Rendering audio ${index + 1}:`, audio.name);
              return (
                <AudioItem
                  shouldDisplayPreview={!isDraggingOverTimeline}
                  handleAddAudio={handleAddAudio}
                  audio={audio}
                  key={audio.id || index}
                />
              );
            })}
            {projectAudios.length === 0 && (
              <div className="text-center text-gray-400 py-8">
                No audio files uploaded yet
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
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
