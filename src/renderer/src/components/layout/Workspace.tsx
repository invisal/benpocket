import React, { useState } from 'react';
import { FileText, X, Home } from 'lucide-react';
import { useLayoutStore, type Tab } from '../../store/layout.store';
import { HomeTab } from './HomeTab';
import { KuberneterWorkspace } from '../../../tools/kuberneter/components/workspace/KuberneterWorkspace';
import { HttpClientWorkspace } from '../../../tools/http-client/HttpClientWorkspace';
import { ScreenRecorderWorkspace } from './workspaces/ScreenRecorderWorkspace';

export const Workspace: React.FC = () => {
  const { openTabs, activeTabId, setActiveTabId, closeTab, renameTab } = useLayoutStore();
  const activeInstanceId = useLayoutStore((s) => s.activeInstanceId);
  const activeTab = openTabs.find((t) => t.id === activeTabId);
  const filteredTabs = openTabs.filter((t) => t.instanceId === activeInstanceId);

  if (activeInstanceId === 'home') {
    return <HomeTab />;
  }

  if (filteredTabs.length === 0 || !activeTab) {
    return (
      <div className="flex-1 bg-editor-bg flex flex-col items-center justify-center gap-3 select-none">
        <svg className="w-16 h-16 text-border-dark" viewBox="0 0 24 24" fill="currentColor">
          <polygon points="12,2 2,22 22,22" />
        </svg>
        <div className="text-zinc-550 text-sm font-semibold">CraftBox Workspace</div>
        <div className="text-zinc-655 text-xs">Open a tool or create a new session to begin.</div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-editor-bg flex flex-col min-w-0 overflow-hidden">
      {/* Tab bar header */}
      <div className="flex h-9 bg-sidebar-bg border-b border-border-dark overflow-x-auto select-none shrink-0 scrollbar-none">
        {filteredTabs.map((tab) => (
          <TabBarItem
            key={tab.id}
            tab={tab}
            isActive={tab.id === activeTabId}
            onActivate={() => setActiveTabId(tab.id)}
            onClose={() => closeTab(tab.id)}
            onRename={(title) => renameTab(tab.id, title)}
          />
        ))}
      </div>

      {/* Editor Content Area */}
      <div className="flex-1 overflow-auto p-4 flex flex-col min-h-0 bg-surface">
        {activeTab.type === 'kuberneter' && (
          <KuberneterWorkspace
            resource={(activeTab.meta as { resource?: string })?.resource || 'overview'}
          />
        )}
        {activeTab.type === 'postman' && <HttpClientWorkspace />}
        {activeTab.type === 'screenrecorder' && <ScreenRecorderWorkspace />}
      </div>
    </div>
  );
};

interface TabBarItemProps {
  tab: Tab;
  isActive: boolean;
  onActivate: () => void;
  onClose: () => void;
  onRename: (title: string) => void;
}

const TabBarItem: React.FC<TabBarItemProps> = ({
  tab,
  isActive,
  onActivate,
  onClose,
  onRename
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(tab.title);

  const isHome = (tab.meta as { resource?: string })?.resource === 'home';

  const commitRename = (): void => {
    const trimmed = draftTitle.trim();
    if (trimmed && trimmed !== tab.title) onRename(trimmed);
    setIsEditing(false);
  };

  if (isHome) {
    return (
      <div
        onClick={onActivate}
        className={`flex items-center justify-center w-10 border-r border-border-dark cursor-pointer text-xs transition-colors shrink-0 ${
          isActive
            ? 'bg-editor-bg text-white border-t-2 border-t-accent'
            : 'bg-sidebar-bg text-zinc-550 hover:bg-editor-bg/40 hover:text-zinc-300'
        }`}
        title="Kuberneter Connection Settings"
      >
        <Home size={14} className={isActive ? 'text-accent' : 'text-zinc-600'} />
      </div>
    );
  }

  if (isEditing) {
    return (
      <div className="flex items-center gap-2 px-3 border-r border-border-dark text-xs shrink-0 bg-editor-bg text-white border-t-2 border-t-accent">
        <FileText size={12} className="text-accent" />
        <input
          type="text"
          autoFocus
          value={draftTitle}
          onChange={(e) => setDraftTitle(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitRename();
            if (e.key === 'Escape') {
              setDraftTitle(tab.title);
              setIsEditing(false);
            }
          }}
          onClick={(e) => e.stopPropagation()}
          className="bg-transparent border-b border-accent outline-none w-24 text-white"
        />
      </div>
    );
  }

  return (
    <div
      onClick={onActivate}
      onDoubleClick={() => {
        setDraftTitle(tab.title);
        setIsEditing(true);
      }}
      title="Double-click to rename"
      className={`flex items-center gap-2 px-3 border-r border-border-dark cursor-pointer text-xs transition-colors shrink-0 group ${
        isActive
          ? 'bg-editor-bg text-white border-t-2 border-t-accent'
          : 'bg-sidebar-bg text-zinc-555 hover:bg-editor-bg/40 hover:text-zinc-300'
      }`}
    >
      <FileText size={12} className={isActive ? 'text-accent' : 'text-zinc-600'} />
      <span className="truncate max-w-30">{tab.title}</span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className="p-0.5 rounded-full hover:bg-border-dark/65 text-zinc-555 group-hover:text-zinc-400 hover:text-white"
      >
        <X size={10} />
      </button>
    </div>
  );
};
