
'use client';

import * as React from 'react';
import { WifiOff } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

/**
 * Monitors the browser connectivity status and displays a visual indicator
 * when the application is running in offline mode.
 */
export function OfflineIndicator() {
  const [isOffline, setIsOffline] = React.useState(false);

  React.useEffect(() => {
    function handleOnline() {
      setIsOffline(false);
    }

    function handleOffline() {
      setIsOffline(true);
    }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Set initial state
    setIsOffline(!navigator.onLine);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[9999] animate-in fade-in slide-in-from-bottom-4">
      <Badge 
        variant="destructive" 
        className="flex items-center gap-2 px-4 py-2 shadow-2xl border-2 border-white ring-4 ring-black/5"
      >
        <WifiOff className="h-4 w-4 animate-pulse" />
        <div className="flex flex-col items-start leading-none">
            <span className="font-black uppercase tracking-widest text-[10px]">Offline Mode</span>
            <span className="text-[8px] opacity-80">Changes will sync when online</span>
        </div>
      </Badge>
    </div>
  );
}
