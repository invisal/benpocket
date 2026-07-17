import type React from 'react';
import { useState } from 'react';
import { X, Minus, Square, Copy, Sun, Moon } from 'lucide-react';
import { useThemeStore } from '../../store/theme.store';

export const TitleBar: React.FC = () => {
  const [isMaximized, setIsMaximized] = useState(false);
  const isMac = window.api?.platform === 'darwin';

  const { theme, toggleTheme } = useThemeStore();

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
    <div className="titlebar-drag h-8 bg-surface-2 border-b border-border flex items-center justify-between text-xs text-text-dim select-none px-2 z-50 shrink-0">
      {/* Left side: macOS Traffic Lights Spacing or App Icon/Menu */}
      {isMac ? (
        <div className="w-20" /> /* Spacer for native macOS traffic lights */
      ) : (
        <div className="flex items-center gap-2 titlebar-nodrag">
          <svg className="w-4 h-4 text-accent" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="12,2 2,22 22,22" />
          </svg>
          <span className="font-semibold text-zinc-350">benpocket</span>
        </div>
      )}

      <div className="flex-1" />

      {/* Right side: Theme toggle and OS window controls */}
      <div className="flex items-center h-full titlebar-nodrag gap-1">
        <div className="flex items-center h-full mr-1 gap-0.5">
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
