import type React from 'react';

export const StatusBar: React.FC = () => {
  return (
    <div className="flex h-7 items-center bg-surface-2 border border-border px-2 text-xs select-none shrink-0">
      <span className="font-medium mr-1">benpocket</span>
      <span> v{__APP_VERSION__}</span>

      <div className="flex-1" />
    </div>
  );
};
