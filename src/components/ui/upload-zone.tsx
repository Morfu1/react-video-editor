import { Droppable } from "@/components/ui/droppable";
import { PlusIcon } from "lucide-react";
import { useProject } from "@/contexts/ProjectContext";
import { useGoogleAuth } from "@/hooks/useGoogleAuth";
import { useRef } from "react";

interface UploadZoneProps {
  acceptedTypes: 'video' | 'image' | 'audio';
  className?: string;
}

export const UploadZone = ({ acceptedTypes, className }: UploadZoneProps) => {
  const { addMediaFile, currentProject } = useProject();
  const { driveConnected } = useGoogleAuth();
  const currentProjectRef = useRef(currentProject);
  currentProjectRef.current = currentProject;

  const getAcceptConfig = () => {
    switch (acceptedTypes) {
      case 'video':
        return {
          'video/*': ['.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm']
        };
      case 'image':
        return {
          'image/*': ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp']
        };
      case 'audio':
        return {
          'audio/*': ['.mp3', '.wav', '.aac', '.ogg', '.flac']
        };
    }
  };

  const getPlaceholderText = () => {
    switch (acceptedTypes) {
      case 'video':
        return 'Upload videos';
      case 'image':
        return 'Upload images';
      case 'audio':
        return 'Upload audio';
    }
  };

  const onSelectFiles = async (files: File[]) => {
    const project = currentProjectRef.current;
    
    if (!project) {
      alert('No project selected. Please select a project first.');
      return;
    }

    try {
      // Add files to project
      for (const file of files) {
        try {
          console.log('Processing file:', file.name, file.type, file.size);
          await addMediaFile(
            project.id, 
            file, 
            driveConnected ? 'both' : 'local'
          );
          console.log('File uploaded successfully:', file.name);
        } catch (error) {
          console.error('Failed to add media file:', error);
        }
      }
    } catch (error) {
      console.error('Failed to handle file upload:', error);
    }
  };

  return (
    <div className={`w-full ${className}`}>
      <Droppable
        maxFileCount={4}
        maxSize={100 * 1024 * 1024} // 100MB for video files
        disabled={false}
        onValueChange={onSelectFiles}
        className="w-full"
        accept={getAcceptConfig()}
        multiple={true}
      >
        <div className="border-2 border-dashed border-gray-600 rounded-lg p-4 text-center hover:border-gray-400 transition-colors cursor-pointer">
          <div className="flex flex-col items-center justify-center gap-2">
            <div className="bg-gray-700 hover:bg-gray-600 rounded-md p-2 transition-colors">
              <PlusIcon className="h-4 w-4 text-gray-300" />
            </div>
            <p className="text-xs text-gray-400">{getPlaceholderText()}</p>
          </div>
        </div>
      </Droppable>
    </div>
  );
};