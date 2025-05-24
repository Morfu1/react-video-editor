import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { useGoogleAuth } from '@/hooks/useGoogleAuth';
import { HardDrive, Cloud, RefreshCw } from 'lucide-react';
import type { StorageLocation } from '@/types/project';

interface StorageLocationSelectorProps {
  value: StorageLocation;
  onChange: (value: StorageLocation) => void;
  className?: string;
}

export const StorageLocationSelector = ({ 
  value, 
  onChange, 
  className 
}: StorageLocationSelectorProps) => {
  const { driveConnected } = useGoogleAuth();

  console.log('StorageLocationSelector render:', { value, driveConnected });

  return (
    <div className={className}>
      <Label className="text-sm font-medium mb-3 block">
        Storage Location
      </Label>
      <div className="space-y-3">
        <div 
          className="flex items-center space-x-2 cursor-pointer p-2 rounded border border-gray-600 hover:bg-gray-800"
          onClick={() => {
            console.log('Local option clicked directly');
            onChange('local');
          }}
        >
          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
            value === 'local' ? 'border-blue-500 bg-blue-500' : 'border-gray-400'
          }`}>
            {value === 'local' && <div className="w-2 h-2 bg-white rounded-full" />}
          </div>
          <div className="flex items-center flex-1">
            <HardDrive className="w-4 h-4 mr-2" />
            <div className="flex-1">
              <div className="font-medium">Local Only</div>
              <div className="text-xs text-muted-foreground">
                Store files in browser storage
              </div>
            </div>
          </div>
        </div>
        
        <div 
          className="flex items-center space-x-2 cursor-pointer p-2 rounded border border-gray-600 hover:bg-gray-800"
          onClick={() => {
            console.log('Drive option clicked directly');
            onChange('drive');
          }}
        >
          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
            value === 'drive' ? 'border-blue-500 bg-blue-500' : 'border-gray-400'
          }`}>
            {value === 'drive' && <div className="w-2 h-2 bg-white rounded-full" />}
          </div>
          <div className="flex items-center">
            <Cloud className="w-4 h-4 mr-2" />
            <div>
              <div className="font-medium">Google Drive</div>
              <div className="text-xs text-muted-foreground">
                {driveConnected 
                  ? 'Store files in Google Drive' 
                  : 'Connect Google Drive to enable'
                }
              </div>
            </div>
          </div>
        </div>
        
        <div 
          className="flex items-center space-x-2 cursor-pointer p-2 rounded border border-gray-600 hover:bg-gray-800"
          onClick={() => {
            console.log('Both option clicked directly');
            onChange('both');
          }}
        >
          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
            value === 'both' ? 'border-blue-500 bg-blue-500' : 'border-gray-400'
          }`}>
            {value === 'both' && <div className="w-2 h-2 bg-white rounded-full" />}
          </div>
          <div className="flex items-center">
            <RefreshCw className="w-4 h-4 mr-2" />
            <div>
              <div className="font-medium">Local + Drive Sync</div>
              <div className="text-xs text-muted-foreground">
                {driveConnected 
                  ? 'Sync between devices via Google Drive' 
                  : 'Connect Google Drive to enable'
                }
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};