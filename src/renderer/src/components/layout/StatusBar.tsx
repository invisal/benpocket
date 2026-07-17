import type React from 'react';
import { useEffect, useState } from 'react';
import { Bug, MousePointerClick } from 'lucide-react';
import cn from 'cnfast';

export const StatusBar: React.FC = () => {
  const [nativeContextMenuEnabled, setNativeContextMenuEnabled] = useState(false);

  useEffect(() => {
    window.api?.debug?.getContextMenuEnabled().then(setNativeContextMenuEnabled);
  }, []);

  const handleToggleContextMenu = async (): Promise<void> => {
    const enabled = await window.api?.debug?.toggleContextMenu();
    setNativeContextMenuEnabled(!!enabled);
  };

  const handleToggleDevTools = (): void => {
    window.api?.debug?.toggleDevTools();
  };

  return (
    <div className="flex h-7 items-center bg-surface-2 border border-border px-2 text-xs select-none shrink-0">
      <span className="font-medium mr-1">benpocket</span>
      <span> v{__APP_VERSION__}</span>

      <div className="flex-1" />

      <div className="flex items-center h-full gap-0.5">
        <button
          onClick={handleToggleContextMenu}
          title={
            nativeContextMenuEnabled
              ? 'Native right-click menu: ON (click to disable)'
              : 'Native right-click menu: OFF (click to enable, e.g. for Inspect Element)'
          }
          className={cn(
            'w-6 h-5.5 rounded hover:bg-border flex items-center justify-center transition-colors cursor-pointer border-none bg-transparent',
            nativeContextMenuEnabled ? 'text-accent' : 'text-zinc-500 hover:text-zinc-200'
          )}
        >
          <MousePointerClick size={12} />
        </button>
        <button
          onClick={handleToggleDevTools}
          title="Toggle DevTools"
          className="w-6 h-5.5 rounded hover:bg-border flex items-center justify-center transition-colors cursor-pointer border-none bg-transparent text-zinc-500 hover:text-zinc-200"
        >
          <Bug size={12} />
        </button>
      </div>
    </div>
  );
};
