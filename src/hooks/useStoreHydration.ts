import { useEffect, useState } from 'react';

/**
 * Hook to track whether the persisted Zustand store has been hydrated
 * This is important to prevent hydration mismatches in SSR apps and
 * to ensure we don't show stale data before persistence is loaded
 * 
 * Note: Currently returns true immediately since the store doesn't use persistence
 */
export const useStoreHydration = () => {
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    // Since the store doesn't use persistence, we can immediately set to hydrated
    setHasHydrated(true);
  }, []);

  return hasHydrated;
};