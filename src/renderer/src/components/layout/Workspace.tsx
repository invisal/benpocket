import React from 'react';
import { FileText, X } from 'lucide-react';
import { useLayoutStore } from '../../store/layout.store';
import { HomeTab } from './HomeTab';
import { LensWorkspace } from './workspaces/LensWorkspace';
import { PostmanWorkspace } from './workspaces/PostmanWorkspace';
import { ScreenStudioWorkspace } from './workspaces/ScreenStudioWorkspace';

export const Workspace: React.FC = () => {
  const { openTabs, activeTabId, setActiveTabId, closeTab } = useLayoutStore();
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
        {filteredTabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          return (
            <div
              key={tab.id}
              onClick={() => setActiveTabId(tab.id)}
              className={`flex items-center gap-2 px-3 border-r border-border-dark cursor-pointer text-xs transition-colors shrink-0 group ${
                isActive
                  ? 'bg-editor-bg text-white border-t-2 border-t-accent'
                  : 'bg-sidebar-bg text-zinc-550 hover:bg-editor-bg/40 hover:text-zinc-300'
              }`}
            >
              <FileText size={12} className={isActive ? 'text-accent' : 'text-zinc-600'} />
              <span className="truncate max-w-[120px]">{tab.title}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(tab.id);
                }}
                className="p-0.5 rounded-full hover:bg-border-dark/65 text-zinc-555 group-hover:text-zinc-400 hover:text-white"
              >
                <X size={10} />
              </button>
            </div>
          );
        })}
      </div>

      {/* Editor Content Area */}
      <div className="flex-1 overflow-auto p-4 flex flex-col min-h-0">
        {activeTab.type === 'lens' && <LensWorkspace />}
        {activeTab.type === 'postman' && <PostmanWorkspace />}
        {activeTab.type === 'screenstudio' && <ScreenStudioWorkspace />}
      </div>
    </div>
  );
};
