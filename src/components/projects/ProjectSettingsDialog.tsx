import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import type { Project, ProjectSettings } from '@/types/project';

interface ProjectSettingsDialogProps {
  project: Project;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (projectId: string, settings: ProjectSettings) => void;
}

const ASPECT_RATIOS = [
  { label: '16:9 (Landscape)', value: '16:9', width: 1920, height: 1080 },
  { label: '9:16 (Portrait)', value: '9:16', width: 1080, height: 1920 },
  { label: '1:1 (Square)', value: '1:1', width: 1080, height: 1080 },
  { label: '4:3 (Classic)', value: '4:3', width: 1440, height: 1080 },
  { label: '21:9 (Ultrawide)', value: '21:9', width: 2560, height: 1080 },
] as const;

const FPS_OPTIONS = [
  { label: '24 fps', value: 24 },
  { label: '30 fps', value: 30 },
  { label: '60 fps', value: 60 },
] as const;

const QUALITY_OPTIONS = [
  { label: 'High', value: 'high' },
  { label: 'Medium', value: 'medium' },
  { label: 'Low', value: 'low' },
] as const;

export const ProjectSettingsDialog = ({
  project,
  open,
  onOpenChange,
  onSave,
}: ProjectSettingsDialogProps) => {
  const [settings, setSettings] = useState<ProjectSettings>(project.settings);

  const getCurrentAspectRatio = () => {
    const { width, height } = settings.resolution;
    const ratio = ASPECT_RATIOS.find(ar => ar.width === width && ar.height === height);
    return ratio?.value || 'custom';
  };

  const handleAspectRatioChange = (value: string) => {
    const ratio = ASPECT_RATIOS.find(ar => ar.value === value);
    if (ratio) {
      setSettings(prev => ({
        ...prev,
        resolution: { width: ratio.width, height: ratio.height }
      }));
    }
  };

  const handleSave = () => {
    onSave(project.id, settings);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Project Settings</DialogTitle>
          <DialogDescription>
            Configure settings for "{project.name}"
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-6 py-4">
          {/* Aspect Ratio */}
          <div className="grid gap-2">
            <Label htmlFor="aspect-ratio">Aspect Ratio</Label>
            <Select
              value={getCurrentAspectRatio()}
              onValueChange={handleAspectRatioChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select aspect ratio" />
              </SelectTrigger>
              <SelectContent>
                {ASPECT_RATIOS.map((ratio) => (
                  <SelectItem key={ratio.value} value={ratio.value}>
                    {ratio.label} ({ratio.width}×{ratio.height})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Custom Resolution */}
          {getCurrentAspectRatio() === 'custom' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="width">Width</Label>
                <Input
                  id="width"
                  type="number"
                  value={settings.resolution.width}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    resolution: { ...prev.resolution, width: parseInt(e.target.value) || 1920 }
                  }))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="height">Height</Label>
                <Input
                  id="height"
                  type="number"
                  value={settings.resolution.height}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    resolution: { ...prev.resolution, height: parseInt(e.target.value) || 1080 }
                  }))}
                />
              </div>
            </div>
          )}

          {/* Frame Rate */}
          <div className="grid gap-2">
            <Label htmlFor="fps">Frame Rate</Label>
            <Select
              value={settings.fps.toString()}
              onValueChange={(value) => setSettings(prev => ({
                ...prev,
                fps: parseInt(value)
              }))}
            >
              <SelectTrigger id="fps">
                <SelectValue placeholder="Select frame rate" />
              </SelectTrigger>
              <SelectContent>
                {FPS_OPTIONS.map((fps) => (
                  <SelectItem key={fps.value} value={fps.value.toString()}>
                    {fps.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Quality */}
          <div className="grid gap-2">
            <Label htmlFor="quality">Quality</Label>
            <Select
              value={settings.quality}
              onValueChange={(value) => setSettings(prev => ({
                ...prev,
                quality: value
              }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select quality" />
              </SelectTrigger>
              <SelectContent>
                {QUALITY_OPTIONS.map((quality) => (
                  <SelectItem key={quality.value} value={quality.value}>
                    {quality.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>


        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save Settings
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};