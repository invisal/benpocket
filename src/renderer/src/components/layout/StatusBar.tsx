import type React from 'react';
import { SyncStatus } from './SyncStatus';
import { TelemetryStatus } from './TelemetryStatus';
import { UpdateStatus } from './UpdateStatus';
import { MemoryStatus } from './MemoryStatus';

export const StatusBar: React.FC = () => {
  return (
    <div className="flex w-full h-7 items-center bg-surface border-t border-border-light text-sm select-none shrink-0 divide-x divide-border">
      <MemoryStatus />

      <div className="h-full flex-1 bg-surface-2" />

      <SyncStatus />
      <TelemetryStatus />
      <UpdateStatus />
    </div>
  );
};
