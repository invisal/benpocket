import type React from 'react';
import { useState } from 'react';
import { X, Minus, Square, Copy, Sun, Moon } from 'lucide-react';
import { useLayoutStore } from '../../store/layout.store';
import { useKuberneterStore } from '../../../tools/kuberneter/store/kuberneter.store';
import { useThemeStore } from '../../store/theme.store';
import { useToolTabs } from '../providers/ToolProvider';
import { KubeTitleBar } from '../../../tools/kuberneter/components/kubeTitleBar';

export const TitleBar: React.FC = () => {
  const [isMaximized, setIsMaximized] = useState(false);
  const isMac = window.api?.platform === 'darwin';

  const { isRightPanelOpen, toggleRightPanel } = useLayoutStore();

  const kuberneterInstanceCluster = useKuberneterStore((s) => s.kuberneterInstanceCluster);

  const { theme, toggleTheme } = useThemeStore();

  const { activeTabId: activeToolTabId, tabs: toolTabs } = useToolTabs();
  const activeToolTab = toolTabs.find((t) => t.id === activeToolTabId);
  const isKuberneterActive = activeToolTab?.type === 'kuberneter';

  const currentInstanceId = isKuberneterActive
    ? (activeToolTab?.payload as { instanceId?: string })?.instanceId || ''
    : '';

  const cluster = currentInstanceId ? kuberneterInstanceCluster[currentInstanceId] || '' : '';

  const handleMinimize = () => {
    window.api?.minimize();
  };

  const handleMaximize = () => {
    window.api?.maximize();
    setIsMaximized(!isMaximized);
  };

  const handleClose = () => {
    window.api?.close();
  };

  return (
    <div className="titlebar-drag h-8 bg-sidebar-bg border-b border-border-dark flex items-center justify-between text-xs text-text-dim select-none px-2 z-50 shrink-0">
      {/* Left side: macOS Traffic Lights Spacing or App Icon/Menu */}
      {isMac ? (
        <div className="w-20" /> /* Spacer for native macOS traffic lights */
      ) : (
        <div className="flex items-center gap-2 titlebar-nodrag">
          <svg className="w-4 h-4 text-accent" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="12,2 2,22 22,22" />
          </svg>
          <span className="font-semibold text-zinc-350">CraftBox</span>
          <div className="hidden md:flex items-center gap-3 ml-4 text-zinc-500">
            <span className="hover:text-zinc-350 cursor-pointer transition-colors">File</span>
            <span className="hover:text-zinc-350 cursor-pointer transition-colors">Edit</span>
            <span className="hover:text-zinc-350 cursor-pointer transition-colors">Selection</span>
            <span className="hover:text-zinc-350 cursor-pointer transition-colors">View</span>
            <span className="hover:text-zinc-350 cursor-pointer transition-colors">Go</span>
          </div>
        </div>
      )}

      {/* Middle: Workspace Title / Search Bar */}
      <div className="flex-1 max-w-sm mx-auto h-5 bg-editor-bg border border-border-dark rounded flex items-center justify-center text-zinc-500 text-[10px] titlebar-nodrag hover:bg-sidebar-bg/60 cursor-pointer transition-colors">
        {isKuberneterActive && cluster ? (
          <KubeTitleBar />
        ) : (
          <span>craftbox (Workspace) - Search</span>
        )}
      </div>

      {/* Right side: Layout toggles and OS window controls */}
      <div className="flex items-center h-full titlebar-nodrag gap-1">
        {/* Layout panel toggles */}
        <div className="flex items-center h-full mr-1 gap-0.5">
          {/* Right Panel Toggle */}
          <button
            onClick={toggleRightPanel}
            title="Toggle Secondary Side Bar"
            className={`w-8 h-6.5 rounded hover:bg-border-dark flex items-center justify-center transition-colors cursor-pointer border-none bg-transparent ${
              isRightPanelOpen ? 'text-accent' : 'text-zinc-500 hover:text-zinc-200'
            }`}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M14 2H2c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1V3c0-.55-.45-1-1-1zM10 13H2V4h8v9zm4 0h-3V4h3v9z" />
            </svg>
          </button>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            title="Toggle Light/Dark Theme"
            className="w-8 h-6.5 rounded hover:bg-border-dark flex items-center justify-center transition-colors cursor-pointer border-none bg-transparent text-zinc-500 hover:text-zinc-200"
          >
            {theme === 'dark' ? <Moon size={13} /> : <Sun size={13} />}
          </button>
        </div>

        {/* OS Specific Controls */}
        {!isMac && (
          <div className="flex items-center h-full border-l border-border-dark/60 pl-1">
            <button
              onClick={handleMinimize}
              className="w-11 h-8 hover:bg-border-dark flex items-center justify-center transition-colors text-zinc-500 hover:text-zinc-200"
            >
              <Minus size={14} />
            </button>
            <button
              onClick={handleMaximize}
              className="w-11 h-8 hover:bg-border-dark flex items-center justify-center transition-colors text-zinc-500 hover:text-zinc-200"
            >
              {isMaximized ? <Copy size={11} /> : <Square size={11} />}
            </button>
            <button
              onClick={handleClose}
              className="w-11 h-8 hover:bg-red-500/90 flex items-center justify-center transition-colors text-zinc-500 hover:text-[#fff]"
            >
              <X size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
