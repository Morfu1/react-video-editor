"use client";
import Timeline from "./timeline";
import useStore from "./store/use-store";
import Navbar from "./navbar";
import useTimelineEvents from "./hooks/use-timeline-events";
import Scene from "./scene";
import StateManager from "@designcombo/state";
import { useEffect, useRef, useState } from "react";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { ImperativePanelHandle } from "react-resizable-panels";
import { getCompactFontData, loadFonts } from "./utils/fonts";
import { SECONDARY_FONT, SECONDARY_FONT_URL } from "./constants/constants";
import MenuList from "./menu-list";
import { MenuItem } from "./menu-item";
import { ControlItem } from "./control-item";
import CropModal from "./crop-modal/crop-modal";
import useDataState from "./store/use-data-state";
import { FONTS } from "./data/fonts";
import FloatingControl from "./control-item/floating-controls/floating-control";
import { useProject } from "@/contexts/ProjectContext";
import { ProjectPickerDialog } from "@/components/projects/ProjectPickerDialog";
import type { Project } from "@/types/project";

const stateManager = new StateManager({
  size: {
    width: 1080,
    height: 1920,
  },
});

// Make StateManager globally accessible for timeline persistence
(window as any).__globalStateManager = stateManager;

const Editor = () => {
  const [projectName, setProjectName] = useState<string>("Untitled video");
  const [showProjectPicker, setShowProjectPicker] = useState(false);
  const [projectPickerTab, setProjectPickerTab] = useState<'existing' | 'new'>('existing');
  const timelinePanelRef = useRef<ImperativePanelHandle>(null);
  const { timeline, playerRef } = useStore();
  const { currentProject, loadProject } = useProject();

  useTimelineEvents();

  const { setCompactFonts, setFonts } = useDataState();

  // Show project picker if no current project
  useEffect(() => {
    if (!currentProject) {
      setProjectName("Untitled video");
      setProjectPickerTab('existing');
      setShowProjectPicker(true);
    } else {
      setProjectName(currentProject.name);
      setShowProjectPicker(false); // Hide picker when project is loaded
    }
  }, [currentProject]);

  const handleSelectProject = async (project: Project) => {
    try {
      console.log('handleSelectProject called with:', project.id, project.name);
      const loadedProject = await loadProject(project.id);
      console.log('Project loaded successfully:', loadedProject?.id);
      setProjectName(project.name);
      setShowProjectPicker(false);
    } catch (error) {
      console.error('Failed to load project:', error);
    }
  };

  useEffect(() => {
    setCompactFonts(getCompactFontData(FONTS));
    setFonts(FONTS);
  }, []);

  useEffect(() => {
    loadFonts([
      {
        name: SECONDARY_FONT,
        url: SECONDARY_FONT_URL,
      },
    ]);
  }, []);

  useEffect(() => {
    const screenHeight = window.innerHeight;
    const desiredHeight = 300;
    const percentage = (desiredHeight / screenHeight) * 100;
    timelinePanelRef.current?.resize(percentage);
  }, []);

  const handleTimelineResize = () => {
    const timelineContainer = document.getElementById("timeline-container");
    if (!timelineContainer) return;

    timeline?.resize(
      {
        height: timelineContainer.clientHeight - 90,
        width: timelineContainer.clientWidth - 40,
      },
      {
        force: true,
      },
    );
  };

  useEffect(() => {
    const onResize = () => handleTimelineResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [timeline]);

  return (
    <div className="flex h-screen w-screen flex-col">
      <Navbar
        projectName={projectName}
        stateManager={stateManager}
        setProjectName={setProjectName}
        onOpenProjectPicker={(tab = 'new') => {
          setProjectPickerTab(tab);
          setShowProjectPicker(true);
        }}
      />
      <ProjectPickerDialog
        open={showProjectPicker}
        onOpenChange={setShowProjectPicker}
        onSelectProject={handleSelectProject}
        defaultTab={projectPickerTab}
      />
      <div className="flex flex-1">
        <ResizablePanelGroup style={{ flex: 1 }} direction="vertical">
          <ResizablePanel className="relative" defaultSize={70}>
            <FloatingControl />
            <div className="flex h-full flex-1">
              <div className="bg-sidebar flex flex-none border-r border-border/80">
                <MenuList />
                <MenuItem />
              </div>
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  position: "relative",
                  flex: 1,
                  overflow: "hidden",
                }}
              >
                <CropModal />
                <Scene stateManager={stateManager} />
              </div>
            </div>
          </ResizablePanel>
          <ResizableHandle />
          <ResizablePanel
            className="min-h-[50px]"
            ref={timelinePanelRef}
            defaultSize={30}
            onResize={handleTimelineResize}
          >
            {playerRef && <Timeline stateManager={stateManager} />}
          </ResizablePanel>
        </ResizablePanelGroup>
        <ControlItem />
      </div>
    </div>
  );
};

export default Editor;
