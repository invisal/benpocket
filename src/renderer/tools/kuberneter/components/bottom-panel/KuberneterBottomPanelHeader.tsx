import type React from 'react';
import { useState, useRef, useEffect } from 'react';
import {
  Terminal as TerminalIcon,
  Pencil,
  Plus,
  ChevronDown,
  X,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { type KuberneterBottomPanelTabItem } from './types';
import { cn } from 'cnfast';

interface KuberneterBottomPanelHeaderProps {
  tabs: KuberneterBottomPanelTabItem[];
  activeTabId: string;
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string, e: React.MouseEvent) => void;
  onAddTab: (type: 'terminal' | 'create-resource') => void;
  isMaximized: boolean;
  onToggleMaximize: () => void;
  onClosePanel: () => void;
}

export const KuberneterBottomPanelHeader: React.FC<KuberneterBottomPanelHeaderProps> = ({
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
  onAddTab,
  isMaximized,
  onToggleMaximize,
  onClosePanel
}) => {
  const [isPlusMenuOpen, setIsPlusMenuOpen] = useState(false);
  const plusMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (plusMenuRef.current && !plusMenuRef.current.contains(e.target as Node)) {
        setIsPlusMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="h-8 shrink-0 flex items-center justify-between px-2 border-b border-border-dark bg-surface-3/60 text-xs select-none">
      {/* Left Side: Tabs List & + Button */}
      <div className="flex items-center h-full min-w-0 flex-1 overflow-visible">
        {/* Scrollable Tabs */}
        <div className="flex items-center gap-0 overflow-x-auto h-full tab-bar-container shrink min-w-0">
          {tabs.map((tab) => {
            const isActive = tab.id === activeTabId;
            const Icon = tab.type === 'terminal' ? TerminalIcon : Pencil;

            return (
              <div
                key={tab.id}
                onClick={() => onSelectTab(tab.id)}
                className={cn(
                  'flex items-center gap-2 px-3 h-full border-r border-border-dark cursor-pointer text-[11px] font-sans transition-colors shrink-0 group relative',
                  isActive
                    ? 'bg-surface-1 text-white font-medium border-t-2 border-t-accent'
                    : 'bg-surface-3/40 text-zinc-400 hover:text-zinc-200 hover:bg-surface-2'
                )}
              >
                <Icon className={cn('size-3.5', isActive ? 'text-accent' : 'text-zinc-500')} />
                <span className="truncate max-w-32">{tab.title}</span>
                <button
                  onClick={(e) => onCloseTab(tab.id, e)}
                  className="p-0.5 rounded-full hover:bg-border-dark/65 text-zinc-500 hover:text-white transition-colors border-none bg-transparent cursor-pointer"
                >
                  <X className="size-3" />
                </button>
              </div>
            );
          })}
        </div>

        {/* Plus (+) Button for New Tab */}
        <div className="relative shrink-0" ref={plusMenuRef}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsPlusMenuOpen((prev) => !prev);
            }}
            title="New Tab"
            className="flex items-center justify-center size-7 hover:bg-border-dark/50 text-zinc-400 hover:text-white rounded transition-colors cursor-pointer border-none bg-transparent ml-1"
          >
            <Plus className="size-4" />
          </button>

          {/* Plus Dropdown Menu */}
          {isPlusMenuOpen && (
            <div className="absolute top-full left-0 mt-1 w-40 bg-surface border border-border-dark rounded-md shadow-2xl z-100 py-1 text-xs">
              <button
                onClick={() => {
                  onAddTab('create-resource');
                  setIsPlusMenuOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-surface-2 text-zinc-300 hover:text-white text-left transition-colors cursor-pointer border-none bg-transparent"
              >
                <Pencil className="size-3.5 text-accent" />
                <span>Create resource</span>
              </button>
              <button
                onClick={() => {
                  onAddTab('terminal');
                  setIsPlusMenuOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-surface-2 text-zinc-300 hover:text-white text-left transition-colors cursor-pointer border-none bg-transparent"
              >
                <TerminalIcon className="size-3.5 text-accent" />
                <span>Terminal Session</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Right Side Actions: Maximize & Collapse */}
      <div className="flex items-center gap-1 shrink-0 pl-2">
        <button
          onClick={onToggleMaximize}
          title={isMaximized ? 'Restore Height' : 'Maximize Panel'}
          className="p-1 text-zinc-500 hover:text-zinc-200 hover:bg-border-dark/40 rounded transition-colors cursor-pointer border-none bg-transparent"
        >
          {isMaximized ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
        </button>

        <button
          onClick={onClosePanel}
          title="Collapse Panel"
          className="p-1 text-zinc-500 hover:text-white hover:bg-border-dark/40 rounded transition-colors cursor-pointer border-none bg-transparent"
        >
          <ChevronDown className="size-4" />
        </button>
      </div>
    </div>
  );
};
