import type React from 'react';
import { SyncStatus } from './SyncStatus';
import { TelemetryStatus } from './TelemetryStatus';
import { UpdateStatus } from './UpdateStatus';

export const StatusBar: React.FC = () => {
  return (
    <div className="flex w-full h-7 items-center bg-surface border border-border text-xs select-none shrink-0 divide-x divide-border">
      <div className="px-4 h-full flex items-center">
        <span className="font-medium mr-1">benpocket</span>
        <span> v{__APP_VERSION__}</span>
      </div>

      <div className="h-full flex-1 bg-surface-2 bg-diagonal-stripes" />

      <SyncStatus />
      <TelemetryStatus />
      <UpdateStatus />
    </div>
  );
};
