import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-20 md:bottom-4 left-4 z-50 flex items-center gap-2 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/90 px-3.5 py-2 text-xs font-medium text-amber-900 dark:text-amber-200 shadow-md">
      <WifiOff className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0" />
      <span>Offline Mode — Encrypted local device vault active</span>
    </div>
  );
};
