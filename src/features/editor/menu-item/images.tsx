import { ScrollArea } from "@/components/ui/scroll-area";
import { IMAGES } from "../data/images";
import { dispatch } from "@designcombo/events";
import { generateId } from "@designcombo/timeline";
import Draggable from "@/components/shared/draggable";
import { IImage } from "@designcombo/types";
import React from "react";
import { useIsDraggingOverTimeline } from "../hooks/is-dragging-over-timeline";
import { ADD_ITEMS } from "@designcombo/state";
import { useProject } from "@/contexts/ProjectContext";
import { UploadZone } from "@/components/ui/upload-zone";
import { Trash2 } from "lucide-react";

export const Images = () => {
  const isDraggingOverTimeline = useIsDraggingOverTimeline();
  const { currentProject } = useProject();
  
  // Debug removed for cleaner console

  // Get uploaded images from current project
  const uploadedImages = React.useMemo(() => {
    if (!currentProject?.mediaFiles) return [];
    return currentProject.mediaFiles
      .filter(file => file.type === 'image')
      .map(file => ({
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
    // dispatch(ADD_IMAGE, {
    //   payload: {
    //     id,
    //     type: "image",
    //     display: {
    //       from: 5000,
    //       to: 10000,
    //     },
    //     details: {
    //       src: payload.details?.src,
    //     },
    //   },
    //   options: {
    //     scaleMode: "fit",
    //   },
    // });
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
    });
  };

  return (
    <div className="flex flex-1 flex-col">
      <div className="text-text-primary flex h-12 flex-none items-center px-4 text-sm font-medium">
        Photos
      </div>
      <ScrollArea>
        <div className="flex flex-col px-2">
          {allImages.length === 0 ? (
            <UploadZone acceptedTypes="image" />
          ) : (
            <>
              {allImages.map((image, index) => {
                return (
                  <ImageItem
                    key={image.id || index}
                    image={image}
                    shouldDisplayPreview={!isDraggingOverTimeline}
                    handleAddImage={handleAddImage}
                  />
                );
              })}
              <UploadZone acceptedTypes="image" className="mt-4" />
            </>
          )}
        </div>
      </ScrollArea>
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
          <div className="w-12 h-12 rounded-md overflow-hidden flex-shrink-0">
            <img
              draggable={false}
              src={image.preview}
              className="w-full h-full object-cover"
              alt="image"
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
