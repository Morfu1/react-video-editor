import React, { createContext, useContext, ReactNode } from 'react';
import { useProjectManager } from '@/hooks/useProjectManager';

type ProjectContextType = ReturnType<typeof useProjectManager>;

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export const ProjectProvider = ({ children }: { children: ReactNode }) => {
  const projectManager = useProjectManager();
  
  return (
    <ProjectContext.Provider value={projectManager}>
      {children}
    </ProjectContext.Provider>
  );
};

export const useProject = () => {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
};