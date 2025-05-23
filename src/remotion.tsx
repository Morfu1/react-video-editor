import { Composition, registerRoot } from 'remotion';
import RemotionComposition from './features/editor/player/remotion-composition';
import { createContext, useContext } from 'react';

/**
 * This file registers the Remotion compositions for server-side rendering.
 * It exposes a "Main" composition that the server can render.
 */

// Create a mock store context for server-side rendering
const StoreContext = createContext({
  trackItemIds: [],
  trackItemsMap: {},
  fps: 30,
  trackItemDetailsMap: {},
  sceneMoveableRef: { current: null },
  size: { width: 1920, height: 1080 },
  transitionsMap: {},
  duration: 5000,
  setPlayerRef: () => {}
});

// Wrapper component that provides mock store data
const StoreProvider = ({ children, size, fps, duration }) => {
  const storeValue = {
    trackItemIds: [],
    trackItemsMap: {},
    fps: fps || 30,
    trackItemDetailsMap: {},
    sceneMoveableRef: { current: null },
    size: size || { width: 1920, height: 1080 },
    transitionsMap: {},
    duration: duration || 5000,
    setPlayerRef: () => {}
  };
  
  return (
    <StoreContext.Provider value={storeValue}>
      {children}
    </StoreContext.Provider>
  );
};

// Export the useStore hook for the Composition component to use
export const useStore = () => useContext(StoreContext);

// Composition wrapper that receives design data and renders the actual composition
const ActualCompositionWrapper = (props) => {
  const { width = 1920, height = 1080, fps = 30, durationInFrames = 150, design, timelineDuration } = props;
  
  console.log('ActualCompositionWrapper received props:', { width, height, fps, durationInFrames, timelineDuration });
  console.log('Design data:', design);
  console.log('TrackItemIds:', design?.trackItemIds);
  console.log('TrackItemsMap keys:', Object.keys(design?.trackItemsMap || {}));
  
  // Use timelineDuration if provided, otherwise calculate from track items, fallback to design.duration
  let finalDuration = design?.duration || 5000;
  
  if (timelineDuration) {
    finalDuration = timelineDuration;
    console.log('Using provided timeline duration:', finalDuration);
  } else if (design?.trackItemsMap && Object.keys(design.trackItemsMap).length > 0) {
    const maxEndTime = Math.max(
      ...Object.values(design.trackItemsMap).map((item: any) => item.display?.to || 0)
    );
    if (maxEndTime > 0) {
      finalDuration = maxEndTime;
      console.log('Calculated timeline duration from track items:', finalDuration);
    }
  }
  
  // Create store value from the design data
  const storeValue = {
    trackItemIds: design?.trackItemIds || [],
    trackItemsMap: design?.trackItemsMap || {},
    fps: fps,
    trackItemDetailsMap: design?.trackItemDetailsMap || {},
    sceneMoveableRef: { current: null },
    size: { width, height },
    transitionsMap: design?.transitionsMap || {},
    duration: finalDuration,
    setPlayerRef: () => {}
  };
  
  return (
    <RemotionComposition storeData={storeValue} />
  );
};

interface Props {
  design: any;
  jobId: string;
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
}

export const RemotionVideo: React.FC = () => {
  return (
    <>
      <Composition
        id="Main"
        component={ActualCompositionWrapper}
        width={1920}
        height={1080}
        fps={30}
        durationInFrames={30}
        defaultProps={{
          width: 1920,
          height: 1080,
          fps: 30,
          durationInFrames: 30,
          design: {}
        }}
        calculateMetadata={({ props }) => {
          // Use the ACTUAL values from inputProps - calculated from design data
          const { width, height, fps, durationInFrames } = props;
          console.log('calculateMetadata received props:', props);
          
          // Must use the calculated values from the server
          return {
            width: Number(width) || 1920,
            height: Number(height) || 1080,
            fps: Number(fps) || 30,
            durationInFrames: Number(durationInFrames) || 30
          };
        }}
      />
    </>
  );
};

// Register the root component for Remotion
registerRoot(RemotionVideo);