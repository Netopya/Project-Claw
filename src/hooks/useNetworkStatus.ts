import { useState, useEffect } from 'react';

export function useNetworkStatus() {
  // Initialize with null to indicate we don't know the status yet (SSR)
  const [isOnline, setIsOnline] = useState<boolean | null>(null);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    // Set initial state after hydration
    setIsOnline(navigator.onLine);

    const handleOnline = () => {
      setIsOnline(true);
      if (wasOffline) {
        // User came back online after being offline
        setWasOffline(false);
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setWasOffline(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [wasOffline]);

  // Return true if we don't know the status yet (assume online during SSR)
  return { 
    isOnline: isOnline ?? true, 
    wasOffline,
    isHydrated: isOnline !== null 
  };
}