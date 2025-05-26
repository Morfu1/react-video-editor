import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { dispatch } from "@designcombo/events";
import { HISTORY_UNDO, HISTORY_REDO, DESIGN_RESIZE } from "@designcombo/state";
import { Icons } from "@/components/shared/icons";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Download, MenuIcon, ShareIcon, Save } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type StateManager from "@designcombo/state";
import { generateId } from "@designcombo/timeline";
import { IDesign } from "@designcombo/types";
import { useDownloadState } from "./store/use-download-state";
import DownloadProgressModal from "./download-progress-modal";
import AutosizeInput from "@/components/ui/autosize-input";
import { debounce } from "lodash";
import { useGoogleAuth } from "@/hooks/useGoogleAuth";
import { useProject } from "@/contexts/ProjectContext";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { UserDropdown } from "@/components/auth/UserDropdown";

export default function Navbar({
  stateManager,
  setProjectName,
  projectName,
  onOpenProjectPicker,
}: {
  stateManager: StateManager;
  setProjectName: (name: string) => void;
  projectName: string;
  onOpenProjectPicker?: (tab?: 'existing' | 'new') => void;
}) {
  const [title, setTitle] = useState(projectName);
  const { user, driveConnected } = useGoogleAuth();
  const { currentProject, createProject, saveCurrentTimeline } = useProject();
  
  // Update title when projectName changes
  useEffect(() => {
    setTitle(projectName);
  }, [projectName]);

  const handleUndo = () => {
    dispatch(HISTORY_UNDO);
  };

  const handleRedo = () => {
    dispatch(HISTORY_REDO);
  };

  const handleCreateProject = async () => {
    try {
      const project = await createProject(
        'Untitled Project',
        undefined,
        driveConnected ? 'both' : 'local'
      );
      setTitle(project.name);
      setProjectName(project.name);
    } catch (error) {
      console.error('Failed to create project:', error);
    }
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    setTitle(newTitle);
    
    // Only update project name if user is actually editing (not programmatic changes)
    // We use a simple debounce here to avoid excessive calls while typing
    clearTimeout((window as any).__titleChangeTimeout);
    (window as any).__titleChangeTimeout = setTimeout(() => {
      if (newTitle !== projectName) {
        console.log("User edited title, updating project name:", newTitle);
        setProjectName(newTitle);
      }
    }, 1000);
  };

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "320px 1fr 320px",
      }}
      className="bg-sidebar pointer-events-none flex h-[58px] items-center border-b border-border/80 px-2"
    >
      <DownloadProgressModal />

      <div className="flex items-center gap-2">
        <div className="pointer-events-auto flex h-12 w-12 items-center justify-center rounded-md text-zinc-200">
          <DropdownMenu>
            <DropdownMenuTrigger>
              <div className="hover:bg-background-subtle flex h-8 w-8 items-center justify-center">
                <MenuIcon className="h-5 w-5" />
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="z-[300] w-56 p-2" align="start">
              <DropdownMenuItem
                onClick={() => onOpenProjectPicker?.('new')}
                className="cursor-pointer text-muted-foreground"
              >
                New project
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => onOpenProjectPicker?.('existing')}
                className="cursor-pointer text-muted-foreground"
              >
                My projects
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleCreateProject}
                className="cursor-pointer text-muted-foreground"
              >
                Duplicate project
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="bg-sidebar pointer-events-auto flex h-12 items-center px-1.5">
          <Button
            onClick={handleUndo}
            className="text-muted-foreground"
            variant="ghost"
            size="icon"
          >
            <Icons.undo width={20} />
          </Button>
          <Button
            onClick={handleRedo}
            className="text-muted-foreground"
            variant="ghost"
            size="icon"
          >
            <Icons.redo width={20} />
          </Button>
        </div>
      </div>

      <div className="flex h-14 items-center justify-center gap-2">
        <div className="bg-sidebar pointer-events-auto flex h-12 items-center gap-2 rounded-md px-2.5 text-muted-foreground">
          <AutosizeInput
            name="title"
            value={title}
            onChange={handleTitleChange}
            width={200}
            inputClassName="border-none outline-none px-1 bg-background text-sm font-medium text-zinc-200"
          />
        </div>
      </div>

      <div className="flex h-14 items-center justify-end gap-2">
        <div className="bg-sidebar pointer-events-auto flex h-12 items-center gap-2 rounded-md px-2.5">
          <Button
            className="flex h-8 gap-1 border border-border"
            variant="outline"
            disabled={!currentProject || currentProject.storage.location === 'local'}
          >
            <ShareIcon width={18} /> Share
          </Button>
          <Button
            className="flex h-8 gap-1 border border-border"
            variant="outline"
            disabled={!currentProject}
            onClick={async () => {
              if (currentProject) {
                try {
                  await saveCurrentTimeline();
                  console.log('Manual save completed');
                } catch (error) {
                  console.error('Manual save failed:', error);
                }
              }
            }}
          >
            <Save width={18} /> Save
          </Button>
          <ExportButton stateManager={stateManager} />
          {user ? (
            <UserDropdown />
          ) : (
            <GoogleSignInButton size="sm" />
          )}
        </div>
      </div>
    </div>
  );
}

const ExportButton = ({ stateManager }: { stateManager: StateManager }) => {
  const { actions } = useDownloadState();

  const handleExport = () => {
    const state = stateManager.getState();
    console.log("Timeline state for export:", {
      duration: state.duration,
      trackItemsLength: Object.keys(state.trackItemsMap || {}).length,
      tracks: state.tracks?.length || 0
    });
    
    // Debug track items to see their actual display values
    if (state.trackItemsMap) {
      console.log("Track items in export:");
      Object.entries(state.trackItemsMap).forEach(([id, item]) => {
        console.log(`  ${id}: from=${item.display?.from}ms, to=${item.display?.to}ms, type=${item.type}`);
      });
    }
    
    // Calculate actual timeline duration from current track items
    let actualTimelineDuration = state.duration;
    if (state.trackItemsMap && Object.keys(state.trackItemsMap).length > 0) {
      const maxEndTime = Math.max(
        ...Object.values(state.trackItemsMap).map((item: any) => item.display?.to || 0)
      );
      if (maxEndTime > 0) {
        actualTimelineDuration = maxEndTime;
        console.log("Calculated actual timeline duration:", actualTimelineDuration, "ms vs state.duration:", state.duration, "ms");
      }
    }
    
    const data = {
      id: generateId(),
      ...state,
      // Use the calculated timeline duration instead of state.duration
      timelineDuration: actualTimelineDuration
    } as IDesign & { timelineDuration: number };

    console.log("Export data:", {
      designDuration: data.duration,
      timelineDuration: data.timelineDuration,
      actualCalculated: actualTimelineDuration
    });

    // Prepare the payload in the state
    actions.setState({ payload: data });
    
    // Show the export dialog which now handles quality selection and save path
    actions.setDisplayProgressModal(true);
  };

  return (
    <Button
      className="flex h-8 gap-1 border border-border"
      variant="outline"
      onClick={handleExport}
    >
      <Download width={18} /> Export
    </Button>
  );
};

interface ResizeOptionProps {
  label: string;
  icon: string;
  value: ResizeValue;
  description: string;
}

interface ResizeValue {
  width: number;
  height: number;
  name: string;
}

const RESIZE_OPTIONS: ResizeOptionProps[] = [
  {
    label: "16:9",
    icon: "landscape",
    description: "YouTube ads",
    value: {
      width: 1920,
      height: 1080,
      name: "16:9",
    },
  },
  {
    label: "9:16",
    icon: "portrait",
    description: "TikTok, YouTube Shorts",
    value: {
      width: 1080,
      height: 1920,
      name: "9:16",
    },
  },
  {
    label: "1:1",
    icon: "square",
    description: "Instagram, Facebook posts",
    value: {
      width: 1080,
      height: 1080,
      name: "1:1",
    },
  },
];

const ResizeVideo = () => {
  const handleResize = (options: ResizeValue) => {
    dispatch(DESIGN_RESIZE, {
      payload: {
        ...options,
      },
    });
  };
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button className="border border-border" variant="secondary">
          Resize
        </Button>
      </PopoverTrigger>
      <PopoverContent className="z-[250] w-60 px-2.5 py-3">
        <div className="text-sm">
          {RESIZE_OPTIONS.map((option, index) => (
            <ResizeOption
              key={index}
              label={option.label}
              icon={option.icon}
              value={option.value}
              handleResize={handleResize}
              description={option.description}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};

const ResizeOption = ({
  label,
  icon,
  value,
  description,
  handleResize,
}: ResizeOptionProps & { handleResize: (payload: ResizeValue) => void }) => {
  const Icon = Icons[icon as "text"];
  return (
    <div
      onClick={() => handleResize(value)}
      className="flex cursor-pointer items-center rounded-md p-2 hover:bg-zinc-50/10"
    >
      <div className="w-8 text-muted-foreground">
        <Icon size={20} />
      </div>
      <div>
        <div>{label}</div>
        <div className="text-xs text-muted-foreground">{description}</div>
      </div>
    </div>
  );
};
