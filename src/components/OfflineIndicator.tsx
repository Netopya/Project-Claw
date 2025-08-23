import { useNetworkStatus } from '../hooks/useNetworkStatus';

export function OfflineIndicator() {
  const { isOnline, wasOffline, isHydrated } = useNetworkStatus();

  // Don't show anything during SSR or if we're online and haven't been offline
  if (!isHydrated || (isOnline && !wasOffline)) {
    return null;
  }

  return (
    <div className={`
      fixed top-0 left-0 right-0 z-50 p-3 text-center text-sm font-medium transition-all duration-300
      ${isOnline 
        ? 'bg-green-600 text-white' 
        : 'bg-red-600 text-white'
      }
    `}>
      {isOnline ? (
        <div className="flex items-center justify-center">
          <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          Back online! Your changes will sync automatically.
        </div>
      ) : (
        <div className="flex items-center justify-center">
          <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          You're offline. Some features may not work properly.
        </div>
      )}
    </div>
  );
}