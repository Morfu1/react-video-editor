import Timeline from "@designcombo/timeline";
import {
  ISize,
  ITimelineScaleState,
  ITimelineScrollState,
  ITrack,
  ITrackItem,
  ITransition,
} from "@designcombo/types";
import Moveable from "@interactify/moveable";
import { PlayerRef } from "@remotion/player";
import { create } from "zustand";

interface ITimelineStore {
  duration: number;
  fps: number;
  scale: ITimelineScaleState;
  scroll: ITimelineScrollState;
  size: ISize;
  tracks: ITrack[];
  trackItemIds: string[];
  transitionIds: string[];
  transitionsMap: Record<string, ITransition>;
  trackItemsMap: Record<string, ITrackItem>;
  trackItemDetailsMap: Record<string, any>;
  activeIds: string[];
  timeline: Timeline | null;
  currentProjectId: string | null;
  setTimeline: (timeline: Timeline) => void;
  setScale: (scale: ITimelineScaleState) => void;
  setScroll: (scroll: ITimelineScrollState) => void;
  playerRef: React.RefObject<PlayerRef> | null;
  setPlayerRef: (playerRef: React.RefObject<PlayerRef> | null) => void;

  sceneMoveableRef: React.RefObject<Moveable> | null;
  setSceneMoveableRef: (ref: React.RefObject<Moveable>) => void;
  setState: (state: any) => Promise<void>;
  setCurrentProjectId: (projectId: string | null) => void;
  
  // Project timeline synchronization
  getTimelineState: () => any;
  loadTimelineState: (timelineData: any) => void;
  clearTimeline: () => void;
}

const useStore = create<ITimelineStore>((set, get) => ({
  size: {
    width: 1920,
    height: 1080,
  },

  timeline: null,
  currentProjectId: null,
  duration: 1000,
  fps: 30,
  scale: {
    // 1x distance (second 0 to second 5, 5 segments).
    index: 7,
    unit: 300,
    zoom: 1 / 300,
    segments: 5,
  },
  scroll: {
    left: 0,
    top: 0,
  },
  playerRef: null,
  trackItemDetailsMap: {},
  activeIds: [],
  targetIds: [],
  tracks: [],
  trackItemIds: [],
  transitionIds: [],
  transitionsMap: {},
  trackItemsMap: {},
  sceneMoveableRef: null,

  setTimeline: (timeline: Timeline) =>
    set(() => ({
      timeline: timeline,
    })),
  setScale: (scale: ITimelineScaleState) =>
    set(() => ({
      scale: scale,
    })),
  setScroll: (scroll: ITimelineScrollState) =>
    set(() => ({
      scroll: scroll,
    })),
  setState: async (state) => {
    return set({ ...state });
  },
  setPlayerRef: (playerRef: React.RefObject<PlayerRef> | null) =>
    set({ playerRef }),
  setSceneMoveableRef: (ref) => set({ sceneMoveableRef: ref }),
  setCurrentProjectId: (projectId: string | null) => 
    set({ currentProjectId: projectId }),
  
  // Project timeline synchronization methods
  getTimelineState: () => {
    const state = get();
    
    // Get actual timeline data from the StateManager if available
    const stateManager = (window as any).__globalStateManager;
    let actualTimelineData = {};
    
    if (stateManager) {
      const smState = stateManager.getState();
      actualTimelineData = {
        tracks: smState.tracks || [],
        trackItemIds: smState.trackItemIds || [],
        transitionIds: smState.transitionIds || [],
        transitionsMap: smState.transitionsMap || {},
        trackItemsMap: smState.trackItemsMap || {},
        trackItemDetailsMap: smState.trackItemDetailsMap || {},
        duration: smState.duration || state.duration,
      };
    } else {
      actualTimelineData = {
        tracks: state.tracks,
        trackItemIds: state.trackItemIds,
        transitionIds: state.transitionIds,
        transitionsMap: state.transitionsMap,
        trackItemsMap: state.trackItemsMap,
        trackItemDetailsMap: state.trackItemDetailsMap,
      };
    }
    
    return {
      duration: state.duration,
      fps: state.fps,
      scale: state.scale,
      scroll: state.scroll,
      size: state.size,
      activeIds: [], // Don't save active selection
      ...actualTimelineData,
    };
  },
  
  loadTimelineState: (timelineData: any) => {
    if (!timelineData) return;
    
    console.log('Loading timeline state:', {
      tracks: timelineData.tracks?.length || 0,
      trackItemIds: timelineData.trackItemIds?.length || 0,
      trackItemsMap: Object.keys(timelineData.trackItemsMap || {}).length
    });
    
    // Load timeline data into Zustand store
    set({
      duration: timelineData.duration || 1000,
      fps: timelineData.fps || 30,
      scale: timelineData.scale || {
        index: 7,
        unit: 300,
        zoom: 1 / 300,
        segments: 5,
      },
      scroll: timelineData.scroll || { left: 0, top: 0 },
      size: timelineData.size || { width: 1920, height: 1080 },
      tracks: timelineData.tracks || [],
      trackItemIds: timelineData.trackItemIds || [],
      transitionIds: timelineData.transitionIds || [],
      transitionsMap: timelineData.transitionsMap || {},
      trackItemsMap: timelineData.trackItemsMap || {},
      trackItemDetailsMap: timelineData.trackItemDetailsMap || {},
      activeIds: [], // Don't restore active selection
    });
    
    // Sync to StateManager if available
    const stateManager = (window as any).__globalStateManager;
    if (stateManager && timelineData.tracks?.length > 0) {
      console.log('Syncing to StateManager...');
      
      // Use StateManager's proper setState method instead of direct assignment
      // This should properly trigger all subscriptions
      const newState = {
        tracks: timelineData.tracks || [],
        trackItemIds: timelineData.trackItemIds || [],
        trackItemsMap: timelineData.trackItemsMap || {},
        trackItemDetailsMap: timelineData.trackItemDetailsMap || {},
        transitionsMap: timelineData.transitionsMap || {},
        transitionIds: timelineData.transitionIds || [],
        duration: timelineData.duration || 1000,
      };
      
      // Use StateManager's updateState method to properly trigger all subscriptions
      try {
        stateManager.updateState(newState, {
          updateHistory: false,
          kind: "timeline:restore"
        });
        console.log('StateManager updateState called - timeline should rebuild');
      } catch (e) {
        console.error('StateManager updateState failed:', e);
        // Fallback: direct assignment + manual notification
        Object.assign(stateManager.state || {}, newState);
        console.log('StateManager fallback: direct state assignment');
      }
    }
  },
  
  clearTimeline: () => {
    set({
      duration: 1000,
      fps: 30,
      scale: {
        index: 7,
        unit: 300,
        zoom: 1 / 300,
        segments: 5,
      },
      scroll: { left: 0, top: 0 },
      tracks: [],
      trackItemIds: [],
      transitionIds: [],
      transitionsMap: {},
      trackItemsMap: {},
      trackItemDetailsMap: {},
      activeIds: [],
    });
  },
}));

export default useStore;