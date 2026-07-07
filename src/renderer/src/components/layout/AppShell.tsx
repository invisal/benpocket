import React, { useEffect } from 'react';
import { TitleBar } from './TitleBar';
import { ActivityBar } from './ActivityBar';
import { LeftPanel } from './LeftPanel';
import { Workspace } from './Workspace';
import { BottomPanel } from './BottomPanel';
import { RightPanel } from './RightPanel';
import { StatusBar } from './StatusBar';
import { useThemeStore } from '../../store/theme.store';

export const AppShell: React.FC = () => {
  const theme = useThemeStore((state) => state.theme);

  useEffect(() => {
    document.documentElement.classList.toggle('light', theme === 'light');
  }, [theme]);

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-zinc-900 text-zinc-300 font-sans antialiased">
      {/* 1. TOP CUSTOM TITLE BAR */}
      <TitleBar />

      {/* 2. MIDDLE AREA (split-grid columns) */}
      <div className="flex-1 flex min-h-0 min-w-0 relative">
        {/* Left Side: Activity Bar */}
        <ActivityBar />

        {/* Collapsible Left Side: Submenu Menus */}
        <LeftPanel />

        {/* Center: Editor Workspace & Bottom Panel split */}
        <div className="flex-1 flex flex-col min-h-0 min-w-0">
          <Workspace />
          <BottomPanel />
        </div>

        {/* Collapsible Right Side: AI Assistant Panel */}
        <RightPanel />
      </div>

      {/* 3. BOTTOM RIBBON STATUS BAR */}
      <StatusBar />
    </div>
  );
};
