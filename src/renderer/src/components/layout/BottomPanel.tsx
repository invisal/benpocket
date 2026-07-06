import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useLayoutStore } from '../../store/layout.store';

export const BottomPanel: React.FC = () => {
  const { bottomPanelHeight, setBottomPanelHeight, isBottomPanelOpen, toggleBottomPanel } =
    useLayoutStore();
  const [activeTab, setActiveTab] = useState<'terminal' | 'output' | 'problems' | 'debug'>(
    'terminal'
  );

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = bottomPanelHeight;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      // Invert sign because dragging up increases height of the bottom panel
      const newHeight = startHeight - (moveEvent.clientY - startY);
      setBottomPanelHeight(newHeight);
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  if (!isBottomPanelOpen) return null;

  return (
    <div
      style={{ height: `${bottomPanelHeight}px` }}
      className="relative bg-bottom-bg border-t border-border-dark flex flex-col w-full select-none shrink-0"
    >
      {/* Top Border Resizer */}
      <div
        onMouseDown={handleMouseDown}
        className="absolute top-0 left-0 w-full h-[3px] cursor-row-resize hover:bg-accent/30 active:bg-accent transition-colors z-40"
      />

      {/* Header / Tabs */}
      <div className="flex items-center justify-between px-3 border-b border-border-dark h-9 shrink-0">
        <div className="flex items-center gap-4 text-xs font-semibold">
          {[
            { id: 'problems', label: 'Problems (0)' },
            { id: 'output', label: 'Output' },
            { id: 'debug', label: 'Debug Console' },
            { id: 'terminal', label: 'Terminal' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-1.5 border-b-2 cursor-pointer transition-all ${
                activeTab === tab.id
                  ? 'border-accent text-accent font-bold'
                  : 'border-transparent text-zinc-550 hover:text-zinc-350'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <button
          onClick={toggleBottomPanel}
          className="p-1 hover:bg-editor-bg rounded text-zinc-555 hover:text-white cursor-pointer transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      {/* Dynamic Content */}
      <div className="flex-1 overflow-auto p-3 text-xs font-mono">
        {activeTab === 'terminal' && (
          <div className="flex flex-col gap-1 text-zinc-450">
            <div className="text-zinc-500">Microsoft Windows [Version 10.0.22631]</div>
            <div className="text-zinc-500">(c) Microsoft Corporation. All rights reserved.</div>
            <div className="mt-2 flex items-center gap-1.5">
              <span className="text-emerald-400">craftbox-shell:</span>
              <span className="text-accent">g:/Projects/craftbox</span>
              <span className="text-zinc-500">$</span>
              <span className="text-zinc-300">npm run dev</span>
            </div>
            <div className="text-accent/80">
              ✔ ready - started server on 0.0.0.0:5173, url: http://localhost:5173
            </div>
            <div className="text-zinc-500">&gt; electron-vite dev --host</div>
            <div className="text-emerald-500/80">✔ main process compiled successfully.</div>
            <div className="text-emerald-500/80">✔ preload process compiled successfully.</div>
            <div className="text-emerald-500/80">✔ renderer process compiled successfully.</div>
          </div>
        )}

        {activeTab === 'output' && (
          <div className="text-zinc-550 italic">No output logs generated in this session.</div>
        )}

        {activeTab === 'problems' && (
          <div className="text-zinc-550 italic">
            No problems have been detected in the workspace.
          </div>
        )}

        {activeTab === 'debug' && (
          <div className="text-zinc-500">
            <span className="text-amber-500">[Warn]</span> Electron: Native APIs sandbox warning
            <br />
            <span className="text-accent">[Info]</span> HMR connected. Listening to react changes...
          </div>
        )}
      </div>
    </div>
  );
};
