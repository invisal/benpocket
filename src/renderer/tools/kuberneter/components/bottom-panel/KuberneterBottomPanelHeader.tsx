import type React from 'react';
import { useRef, useEffect } from 'react';
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
import { ContextMenu } from '@renderer/components/ui/ContextMenu';
import { Menu } from '@renderer/components/ui/Menu';
import { cn } from 'cnfast';

interface KuberneterBottomPanelHeaderProps {
  tabs: KuberneterBottomPanelTabItem[];
  activeTabId: string;
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string, e?: React.MouseEvent) => void;
  onCloseOtherTabs: (id: string) => void;
  onCloseToRightTabs: (id: string) => void;
  onCloseAllTabs: () => void;
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
  onCloseOtherTabs,
  onCloseToRightTabs,
  onCloseAllTabs,
  onAddTab,
  isMaximized,
  onToggleMaximize,
  onClosePanel
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!activeTabId || !containerRef.current) return;
    const activeEl = containerRef.current.querySelector('[data-active="true"]');
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    }
  }, [activeTabId]);

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (containerRef.current) {
      containerRef.current.scrollLeft += e.deltaY;
    }
  };

  return (
    <div className="h-8 shrink-0 flex items-center justify-between px-2 border-b border-border-dark bg-surface-2 text-sm select-none">
      {/* Left Side: Tabs List & + Button */}
      <div className="flex items-center h-full min-w-0 flex-1 overflow-visible">
        {/* Scrollable Tabs */}
        <div
          ref={containerRef}
          onWheel={handleWheel}
          className="flex items-center gap-0 overflow-x-auto h-full tab-bar-container shrink min-w-0"
        >
          {tabs.map((tab, idx) => {
            const isActive = tab.id === activeTabId;
            const Icon = tab.type === 'terminal' ? TerminalIcon : Pencil;
            const isOnlyTab = tabs.length === 1;
            const isLastTab = idx === tabs.length - 1;

            return (
              <ContextMenu.Root key={tab.id}>
                <ContextMenu.Trigger
                  render={
                    <div
                      data-active={isActive}
                      onClick={() => onSelectTab(tab.id)}
                      className={cn(
                        'flex items-center gap-2 px-3 h-full border-r border-border-dark cursor-pointer text-[11px] font-sans transition-colors shrink-0 group relative',
                        isActive
                          ? 'bg-surface text-strong font-medium border-t-2 border-t-accent'
                          : 'bg-surface-2 text-muted-foreground hover:text-foreground hover:bg-surface-3'
                      )}
                    >
                      <Icon
                        className={cn(
                          'size-3.5',
                          isActive ? 'text-accent' : 'text-muted-foreground'
                        )}
                      />
                      <span className="truncate max-w-32">{tab.title}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onCloseTab(tab.id, e);
                        }}
                        className="p-0.5 rounded-full hover:bg-surface-3 text-muted-foreground hover:text-foreground transition-colors border-none bg-transparent cursor-pointer"
                      >
                        <X className="size-3" />
                      </button>
                    </div>
                  }
                />
                <ContextMenu.Content>
                  <ContextMenu.Item
                    onClick={(e) => {
                      e?.stopPropagation?.();
                      onCloseTab(tab.id);
                    }}
                  >
                    Close
                  </ContextMenu.Item>
                  <ContextMenu.Item disabled={isOnlyTab} onClick={() => onCloseOtherTabs(tab.id)}>
                    Close Other
                  </ContextMenu.Item>
                  <ContextMenu.Item disabled={isLastTab} onClick={() => onCloseToRightTabs(tab.id)}>
                    Close to the Right
                  </ContextMenu.Item>
                  <ContextMenu.Item onClick={() => onCloseAllTabs()}>Close All</ContextMenu.Item>
                </ContextMenu.Content>
              </ContextMenu.Root>
            );
          })}
        </div>

        {/* Plus (+) Button for New Tab */}
        <Menu.Root>
          <Menu.Trigger
            render={
              <button
                title="New Tab"
                className="flex items-center justify-center size-7 hover:bg-surface-3 text-muted-foreground hover:text-foreground rounded transition-colors cursor-pointer border-none bg-transparent ml-1 shrink-0"
              >
                <Plus className="size-4" />
              </button>
            }
          />
          <Menu.Content align="start" className="w-44 p-1">
            <Menu.Item
              onClick={() => onAddTab('create-resource')}
              className="flex items-center gap-2 px-2.5 py-1.5 text-sm text-foreground cursor-pointer rounded hover:bg-surface-2"
            >
              <Pencil className="size-3.5 text-accent" />
              <span>Create resource</span>
            </Menu.Item>
            <Menu.Item
              onClick={() => onAddTab('terminal')}
              className="flex items-center gap-2 px-2.5 py-1.5 text-sm text-foreground cursor-pointer rounded hover:bg-surface-2"
            >
              <TerminalIcon className="size-3.5 text-accent" />
              <span>Terminal Session</span>
            </Menu.Item>
          </Menu.Content>
        </Menu.Root>
      </div>

      {/* Right Side Actions: Maximize & Collapse */}
      <div className="flex items-center gap-1 shrink-0 pl-2">
        <button
          onClick={onToggleMaximize}
          title={isMaximized ? 'Restore Height' : 'Maximize Panel'}
          className="p-1 text-muted-foreground hover:text-foreground hover:bg-surface-3 rounded transition-colors cursor-pointer border-none bg-transparent"
        >
          {isMaximized ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
        </button>

        <button
          onClick={onClosePanel}
          title="Collapse Panel"
          className="p-1 text-muted-foreground hover:text-foreground hover:bg-surface-3 rounded transition-colors cursor-pointer border-none bg-transparent"
        >
          <ChevronDown className="size-4" />
        </button>
      </div>
    </div>
  );
};
