import { useEffect, useState } from 'react';
import useStore from '@/features/editor/store/use-store';

/**
 * Hook to track whether the persisted Zustand store has been hydrated
 * This is important to prevent hydration mismatches in SSR apps and
 * to ensure we don't show stale data before persistence is loaded
 */
export const useStoreHydration = () => {
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    // Check if the store has already been hydrated
    if (useStore.persist.hasHydrated()) {
      setHasHydrated(true);
    } else {
      // Listen for hydration completion
      const unsubscribe = useStore.persist.onFinishHydration(() => {
        setHasHydrated(true);
      });
      
      return unsubscribe;
    }
  }, []);

  return hasHydrated;
};