import { PlusIcon } from "lucide-react";
import { useRef } from "react";
import { cn } from "@/lib/utils";

interface SimpleUploadButtonProps {
  acceptedTypes: 'video' | 'image' | 'audio';
  onFilesSelected: (files: File[]) => void;
  className?: string;
  multiple?: boolean;
}

export const SimpleUploadButton = ({ 
  acceptedTypes, 
  onFilesSelected, 
  className,
  multiple = true 
}: SimpleUploadButtonProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getAcceptAttribute = () => {
    switch (acceptedTypes) {
      case 'video':
        return 'video/*,.mp4,.avi,.mov,.wmv,.flv,.webm';
      case 'image':
        return 'image/*,.jpg,.jpeg,.png,.gif,.bmp,.webp';
      case 'audio':
        return 'audio/*,.mp3,.wav,.aac,.ogg,.flac';
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

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length > 0) {
      onFilesSelected(files);
    }
    // Reset the input so the same file can be selected again if needed
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className={cn("w-full", className)}>
      <input
        ref={fileInputRef}
        type="file"
        accept={getAcceptAttribute()}
        multiple={multiple}
        onChange={handleFileChange}
        className="hidden"
      />
      <button
        onClick={handleClick}
        className="w-full border-2 border-dashed border-gray-600 rounded-lg p-4 text-center hover:border-gray-400 transition-colors cursor-pointer bg-transparent"
      >
        <div className="flex flex-col items-center justify-center gap-2">
          <div className="bg-gray-700 hover:bg-gray-600 rounded-md p-2 transition-colors">
            <PlusIcon className="h-4 w-4 text-gray-300" />
          </div>
          <p className="text-xs text-gray-400">{getPlaceholderText()}</p>
        </div>
      </button>
    </div>
  );
};