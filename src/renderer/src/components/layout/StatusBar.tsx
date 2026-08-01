import type React from 'react';
import { SyncStatus } from './SyncStatus';

export const StatusBar: React.FC = () => {
  return (
    <div className="flex w-full h-7 items-center bg-surface border border-border px-2 text-xs select-none shrink-0 gap-4">
      <span className="font-medium mr-1">benpocket</span>
      <span> v{__APP_VERSION__}</span>

      <div className="h-full flex-1 border-l border-border bg-surface-2 bg-diagonal-stripes" />

      <SyncStatus />
    </div>
  );
};
