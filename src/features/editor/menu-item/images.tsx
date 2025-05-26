import { ScrollArea } from "@/components/ui/scroll-area";

import { dispatch } from "@designcombo/events";
import { generateId } from "@designcombo/timeline";
import Draggable from "@/components/shared/draggable";
import { IImage } from "@designcombo/types";
import React from "react";
import { useIsDraggingOverTimeline } from "../hooks/is-dragging-over-timeline";
import { ADD_ITEMS } from "@designcombo/state";
import { useProject } from "@/contexts/ProjectContext";
import useStore from "../store/use-store";
import { SimpleUploadButton } from "@/components/ui/simple-upload-button";
import { useGoogleAuth } from "@/hooks/useGoogleAuth";
import { Trash2 } from "lucide-react";

export const Images = () => {
  const isDraggingOverTimeline = useIsDraggingOverTimeline();
  const { currentProject, addMediaFile } = useProject();
  const { driveConnected } = useGoogleAuth();
  const { size } = useStore();
  
  // Debug removed for cleaner console

  // Get uploaded images from current project
  const uploadedImages = React.useMemo(() => {
    if (!currentProject?.mediaFiles) return [];
    const imageFiles = currentProject.mediaFiles.filter(file => file.type === 'image');
    console.log('Image files in project:', imageFiles.length, imageFiles.map(f => f.name));
    return imageFiles.map(file => ({
      id: file.id,
      details: { src: file.url },
      preview: file.url,
      type: 'image' as const,
      name: file.name
    } as Partial<IImage>));
  }, [currentProject?.mediaFiles]);

  // Show only project images (no stock images)
  const allImages = React.useMemo(() => {
    return uploadedImages;
  }, [uploadedImages]);

  const handleAddImage = (payload: Partial<IImage>) => {
    const id = generateId();
    dispatch(ADD_ITEMS, {
      payload: {
        trackItems: [
          {
            id,
            type: "image",
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
      console.log(`Processing ${newFiles.length} image files sequentially`);
      for (const [index, file] of newFiles.entries()) {
        try {
          console.log(`Processing image file ${index + 1}/${newFiles.length}:`, file.name, file.type, file.size);
          await addMediaFile(
            currentProject.id, 
            file, 
            driveConnected ? 'both' : 'local'
          );
          console.log(`Image file ${index + 1} uploaded successfully:`, file.name);
        } catch (error) {
          console.error(`Failed to add image file ${index + 1}:`, error);
        }
      }
      console.log('All image files processed successfully');
    } catch (error) {
      console.error('Failed to handle file upload:', error);
    }
  };

  return (
    <div className="flex flex-1 flex-col h-full">
      <div className="text-text-primary flex h-12 flex-none items-center px-4 text-sm font-medium">
        Photos
      </div>
      <div className="flex-1 min-h-0 flex flex-col">
        <div className="px-2 py-2 border-b border-gray-700">
          <SimpleUploadButton 
            acceptedTypes="image" 
            onFilesSelected={handleFileUpload}
          />
        </div>
        <ScrollArea className="flex-1">
          <div className="flex flex-col px-2 space-y-2 py-2">
            {allImages.map((image, index) => {
              console.log(`Rendering image ${index + 1}:`, image.name);
              return (
                <ImageItem
                  key={image.id || index}
                  image={image}
                  shouldDisplayPreview={!isDraggingOverTimeline}
                  handleAddImage={handleAddImage}
                />
              );
            })}
            {allImages.length === 0 && (
              <div className="text-center text-gray-400 py-8">
                No images uploaded yet
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
};

const ImageItem = ({
  handleAddImage,
  image,
  shouldDisplayPreview,
}: {
  handleAddImage: (payload: Partial<IImage>) => void;
  image: Partial<IImage>;
  shouldDisplayPreview: boolean;
}) => {
  const { currentProject, removeMediaFileFromProject } = useProject();

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (currentProject && image.id) {
      try {
        await removeMediaFileFromProject(currentProject.id, image.id);
      } catch (error) {
        console.error('Failed to remove image:', error);
      }
    }
  };
  const style = React.useMemo(
    () => ({
      backgroundImage: `url(${image.preview})`,
      backgroundSize: "cover",
      width: "80px",
      height: "80px",
    }),
    [image.preview],
  );

  return (
    <div className="flex items-center gap-2 p-2 rounded-md hover:bg-gray-800 group">
      <Draggable
        data={image}
        renderCustomPreview={<div style={style} />}
        shouldDisplayPreview={shouldDisplayPreview}
      >
        <div
          onClick={() =>
            handleAddImage({
              id: generateId(),
              details: {
                src: image.details!.src,
              },
            } as IImage)
          }
          className="flex items-center gap-3 cursor-pointer flex-1"
        >
          <div className="w-12 h-12 rounded-md overflow-hidden flex-shrink-0 bg-gray-700">
            <img
              draggable={false}
              src={image.preview}
              className="w-full h-full object-cover"
              alt="image"
              onError={(e) => {
                console.error('Image thumbnail load error:', e);
                e.currentTarget.style.display = 'none';
                const placeholder = document.createElement('div');
                placeholder.className = 'w-full h-full bg-gray-600 flex items-center justify-center text-xs text-gray-300';
                placeholder.textContent = 'Image';
                e.currentTarget.parentElement?.appendChild(placeholder);
              }}
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">
              {image.name || 'Untitled Image'}
            </p>
            <p className="text-xs text-gray-400">Uploaded Image</p>
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
