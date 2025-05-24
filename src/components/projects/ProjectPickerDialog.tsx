import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProjectCard } from './ProjectCard';
import { StorageLocationSelector } from './StorageLocationSelector';
import { useProject } from '@/contexts/ProjectContext';
import { useGoogleAuth } from '@/hooks/useGoogleAuth';
import { Plus, Search } from 'lucide-react';
import type { Project, StorageLocation } from '@/types/project';

interface ProjectPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectProject: (project: Project) => void;
  defaultTab?: 'existing' | 'new';
}

export const ProjectPickerDialog = ({ 
  open, 
  onOpenChange, 
  onSelectProject,
  defaultTab = 'existing'
}: ProjectPickerDialogProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [newProjectName, setNewProjectName] = useState('My Awesome Video');
  const [newProjectLocation, setNewProjectLocation] = useState<StorageLocation>('local');

  const handleLocationChange = (location: StorageLocation) => {
    console.log('Storage location changed:', location);
    setNewProjectLocation(location);
  };
  const [isCreating, setIsCreating] = useState(false);
  
  const { projects, createProject, deleteProject } = useProject();
  const { driveConnected } = useGoogleAuth();

  const filteredProjects = projects.filter(project =>
    project.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;
    
    console.log('Creating project:', {
      name: newProjectName,
      location: newProjectLocation,
      createProjectAvailable: !!createProject
    });
    
    setIsCreating(true);
    try {
      const project = await createProject(
        newProjectName,
        undefined, // No template for now
        newProjectLocation
      );
      console.log('Project created successfully:', project);
      onSelectProject(project);
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to create project:', error);
      alert(`Failed to create project: ${error}`);
    } finally {
      setIsCreating(false);
    }
  };

  const handleSelectProject = (project: Project) => {
    onSelectProject(project);
    onOpenChange(false);
  };

  const handleDeleteProject = async (project: Project) => {
    try {
      await deleteProject(project.id);
    } catch (error) {
      console.error('Failed to delete project:', error);
      alert(`Failed to delete project: ${error}`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Select or Create Project</DialogTitle>
          <DialogDescription>
            Choose an existing project or create a new one to start editing.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue={defaultTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="existing">Existing Projects</TabsTrigger>
            <TabsTrigger value="new">New Project</TabsTrigger>
          </TabsList>
          
          <TabsContent value="existing" className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search projects..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <div className="grid gap-4 max-h-96 overflow-y-auto">
              {filteredProjects.length > 0 ? (
                filteredProjects.map(project => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    onSelect={handleSelectProject}
                    onDelete={handleDeleteProject}
                  />
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  {searchQuery ? 'No projects found matching your search.' : 'No projects yet. Create your first project!'}
                </div>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="new" className="space-y-4">
            <div className="space-y-4">
              <div>
                <Label htmlFor="project-name">Project Name</Label>
                <Input
                  id="project-name"
                  placeholder="My Awesome Video"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                />
              </div>
              
              <StorageLocationSelector
                value={newProjectLocation}
                onChange={handleLocationChange}
              />
              
              <Button 
                onClick={handleCreateProject}
                disabled={!newProjectName.trim() || isCreating}
                className="w-full"
              >
                <Plus className="w-4 h-4 mr-2" />
                {isCreating ? 'Creating Project...' : 'Create Project'}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};