import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SyncStatusIndicator } from './SyncStatusIndicator';
import { formatDistanceToNow } from 'date-fns';
import { Play, Trash2, Share2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import type { Project } from '@/types/project';

interface ProjectCardProps {
  project: Project;
  onSelect: (project: Project) => void;
  onDelete?: (project: Project) => void;
  onShare?: (project: Project) => void;
  className?: string;
}

export const ProjectCard = ({ 
  project, 
  onSelect, 
  onDelete, 
  onShare,
  className 
}: ProjectCardProps) => {
  const handleSelect = () => onSelect(project);
  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    onShare?.(project);
  };

  return (
    <Card 
      className={`cursor-pointer hover:shadow-md transition-shadow ${className}`}
      onClick={handleSelect}
    >
      <CardContent className="p-4">
        <div className="flex justify-between items-start mb-2">
          <h3 className="font-semibold text-lg truncate">{project.name}</h3>
          <SyncStatusIndicator project={project} />
        </div>
        
        <div className="text-sm text-muted-foreground mb-2">
          {project.settings.resolution.width} × {project.settings.resolution.height} • {project.settings.fps}fps
        </div>
        
        <div className="text-xs text-muted-foreground">
          Modified {formatDistanceToNow(new Date(project.updatedAt))} ago
        </div>
        
        {project.mediaFiles.length > 0 && (
          <div className="text-xs text-muted-foreground mt-1">
            {project.mediaFiles.length} media file{project.mediaFiles.length !== 1 ? 's' : ''}
          </div>
        )}
      </CardContent>
      
      <CardFooter className="p-4 pt-0 flex gap-2">
        <Button 
          size="sm" 
          className="flex-1"
          onClick={handleSelect}
        >
          <Play className="w-4 h-4 mr-2" />
          Open
        </Button>
        
        {onShare && project.storage.location !== 'local' && (
          <Button 
            size="sm" 
            variant="outline"
            onClick={handleShare}
          >
            <Share2 className="w-4 h-4" />
          </Button>
        )}
        
        {onDelete && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button 
                size="sm" 
                variant="outline"
                onClick={(e) => e.stopPropagation()}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Project</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete "{project.name}"? This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction 
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(project);
                  }}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </CardFooter>
    </Card>
  );
};