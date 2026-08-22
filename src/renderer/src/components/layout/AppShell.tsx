import type React from 'react';
import { useEffect, useState } from 'react';
import { ActivityBar } from './ActivityBar';
import { useSyncDocumentTheme, useThemeStore } from '../../store/theme.store';
import { useLayoutStore } from '../../store/layout.store';
import { useTitleBarStore } from '../../store/titleBar.store';
import { Copy, Minus, Moon, Square, Sun, X } from 'lucide-react';
import { StatusBar } from './StatusBar';
import { ToolTabContents } from '../providers/ToolProvider';

export const AppShell: React.FC = () => {
  useSyncDocumentTheme();

  const toggleBottomPanel = useLayoutStore((s) => s.toggleBottomPanel);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === '`' || e.code === 'Backquote')) {
        e.preventDefault();
        toggleBottomPanel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleBottomPanel]);

  return (
    <div className="h-screen w-screen flex overflow-hidden bg-zinc-900 text-zinc-300 font-sans antialiased">
      <ActivityBar />
      <div className="w-full flex flex-col">
        <div className="h-11 titlebar-drag bg-surface border-b border-border-light items-center flex">
          <TitleBarText />
          <TitleBarControl />
        </div>
        <div className="flex-1 overflow-hidden">
          <ToolTabContents />
        </div>
        <StatusBar />
      </div>
    </div>
  );
};

function TitleBarText() {
  const content = useTitleBarStore((s) => s.content);

  return (
    <div id="title-bar" className="text-foreground px-3 flex-1 text-sm font-medium text-strong">
      {content ?? 'Benpocket'}
    </div>
  );
}

function TitleBarControl() {
  const [isMaximized, setIsMaximized] = useState(false);

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
    <div className="titlebar-nodrag flex items-center h-full border-l border-border-dark/60 pl-1 mr-2">
      <button
        type="button"
        tabIndex={-1}
        onClick={toggleTheme}
        title="Toggle Light/Dark Theme"
        className="size-7 rounded hover:bg-border-dark flex items-center justify-center transition-colors cursor-pointer border-none bg-transparent text-zinc-500 hover:text-zinc-200"
      >
        {theme === 'dark' ? <Moon size={13} /> : <Sun size={13} />}
      </button>

      <button
        type="button"
        tabIndex={-1}
        onClick={handleMinimize}
        className="size-7 hover:bg-border-dark flex items-center justify-center transition-colors text-zinc-500 hover:text-zinc-200"
      >
        <Minus size={14} />
      </button>
      <button
        type="button"
        tabIndex={-1}
        onClick={handleMaximize}
        className="size-7 hover:bg-border-dark flex items-center justify-center transition-colors text-zinc-500 hover:text-zinc-200"
      >
        {isMaximized ? <Copy size={11} /> : <Square size={11} />}
      </button>
      <button
        type="button"
        tabIndex={-1}
        onClick={handleClose}
        className="size-7 hover:bg-red-500/90 flex items-center justify-center transition-colors text-zinc-500 hover:text-[#fff]"
      >
        <X size={14} />
      </button>
    </div>
  );
}
