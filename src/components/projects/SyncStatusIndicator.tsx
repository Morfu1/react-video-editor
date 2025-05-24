import { Badge } from '@/components/ui/badge';
import { HardDrive, Cloud, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';
import type { Project } from '@/types/project';

interface SyncStatusIndicatorProps {
  project: Project;
  className?: string;
}

export const SyncStatusIndicator = ({ project, className }: SyncStatusIndicatorProps) => {
  const getStatusInfo = () => {
    switch (project.storage.location) {
      case 'local':
        return { 
          icon: HardDrive, 
          color: 'blue', 
          text: 'Local',
          variant: 'secondary' as const
        };
      case 'drive':
        return { 
          icon: Cloud, 
          color: 'green', 
          text: 'Drive',
          variant: 'default' as const
        };
      case 'both':
        if (project.storage.lastSync) {
          const lastSyncDate = new Date(project.storage.lastSync);
          const isRecent = Date.now() - lastSyncDate.getTime() < 5 * 60 * 1000; // 5 minutes
          
          return {
            icon: isRecent ? CheckCircle : RefreshCw,
            color: isRecent ? 'green' : 'yellow',
            text: isRecent ? 'Synced' : 'Pending',
            variant: 'default' as const
          };
        }
        return { 
          icon: AlertCircle, 
          color: 'yellow', 
          text: 'Not Synced',
          variant: 'destructive' as const
        };
      default:
        return { 
          icon: AlertCircle, 
          color: 'red', 
          text: 'Unknown',
          variant: 'destructive' as const
        };
    }
  };

  const { icon: Icon, text, variant } = getStatusInfo();

  return (
    <Badge variant={variant} className={className}>
      <Icon className="w-3 h-3 mr-1" />
      {text}
    </Badge>
  );
};