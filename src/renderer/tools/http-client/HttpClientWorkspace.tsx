import type React from 'react';
import { useEffect, useState, type ComponentType } from 'react';
import { Tabs } from '@base-ui/react/tabs';
import { FileText, Globe, Waves, X } from 'lucide-react';
import { cn } from 'cnfast';
import { usePostmanTabsStore, type PostmanTab } from './store/tabs.store';
import { useCollectionsStore } from './store/collections.store';
import { useEnvironmentsStore } from './store/environments.store';
import { useWorkspacesStore } from './store/workspaces.store';
import { HttpClientSidebar } from './HttpClientSidebar';
import { useApiClient, disposeApiClientTab, type ProtocolTab } from './hooks/useApiClient';
import type { PostmanTabSeed } from './types';
import { RequestComposer } from './components/RequestComposer';
import { RequestEditorPanel } from './components/RequestEditorPanel';
import { ResponseInspector } from './components/ResponseInspector';
import { WebSocketComposer } from './components/WebSocketComposer';
import { WebSocketLog } from './components/WebSocketLog';
import { SaveRequestPopover } from './components/SaveRequestPopover';
import { EnvironmentSelector } from './components/EnvironmentSelector';
import { CodeSnippetPopover } from './components/CodeSnippetPopover';
import { ContextMenu } from '@renderer/components/ui/ContextMenu';

// Mirrors the nav-item pattern in screen-recorder/ScreenRecorderApp.tsx, so every
// tool's top-level mode switcher (record/library/... there, HTTP/WebSocket here)
// looks and behaves the same way.
const PROTOCOL_ITEMS: {
  value: ProtocolTab;
  label: string;
  icon: ComponentType<{ size?: number }>;
}[] = [
  { value: 'HTTP', label: 'REST Client', icon: Globe },
  { value: 'WEBSOCKET', label: 'WebSocket Client', icon: Waves }
];

/**
 * HTTP Client's own sidebar + request-tab system, entirely self-contained so it
 * no longer depends on the app's global left panel / tool-tab switcher (both of
 * which were replaced by `ToolTabContents` and only manage the top-level tool
 * tabs, not this tool's internal request tabs).
 */
export const HttpClientWorkspace: React.FC = () => {
  const tabs = usePostmanTabsStore((s) => s.tabs);
  const activeTabId = usePostmanTabsStore((s) => s.activeTabId);
  const selectTab = usePostmanTabsStore((s) => s.setActiveTabId);
  const closeTab = usePostmanTabsStore((s) => s.closeTab);
  const renameTab = usePostmanTabsStore((s) => s.renameTab);
  const openNewRequestTab = usePostmanTabsStore((s) => s.openNewRequestTab);

  const workspacesLoaded = useWorkspacesStore((s) => s.isLoaded);
  const loadWorkspaces = useWorkspacesStore((s) => s.load);
  const activeWorkspaceId = useWorkspacesStore((s) => s.activeWorkspaceId);
  const loadCollections = useCollectionsStore((s) => s.load);
  const loadEnvironments = useEnvironmentsStore((s) => s.load);

  useEffect(() => {
    if (!workspacesLoaded) loadWorkspaces();
  }, [workspacesLoaded, loadWorkspaces]);

  // Re-scope collections/environments to whichever workspace is active, both on
  // first load and whenever the user switches workspaces.
  useEffect(() => {
    if (activeWorkspaceId) {
      loadCollections();
      loadEnvironments();
    }
  }, [activeWorkspaceId, loadCollections, loadEnvironments]);

  const handleCloseTab = (id: string): void => {
    closeTab(id);
    disposeApiClientTab(id);
  };

  const handleCloseOthers = (keepId: string): void => {
    for (const t of tabs) {
      if (t.id !== keepId) handleCloseTab(t.id);
    }
  };

  const handleCloseAll = (): void => {
    for (const t of tabs) handleCloseTab(t.id);
  };

  return (
    <div className="flex flex-1 min-h-0">
      <aside className="w-64 shrink-0 border-r border-border-dark overflow-y-auto p-3">
        <HttpClientSidebar />
      </aside>

      <div className="flex-1 min-w-0 flex flex-col min-h-0">
        {tabs.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 select-none text-center">
            <div className="text-zinc-550 text-sm font-semibold">No request open</div>
            <div className="text-zinc-655 text-xs">
              Create a request from the sidebar to get started.
            </div>
            <button
              onClick={() => openNewRequestTab()}
              className="mt-1 px-3 py-1.5 bg-editor-bg border border-border-dark hover:bg-border-dark/50 rounded text-xs text-zinc-300 hover:text-white cursor-pointer transition-all"
            >
              New Request
            </button>
          </div>
        ) : (
          <>
            <div className="flex h-9 bg-sidebar-bg border-b border-border-dark overflow-x-auto select-none shrink-0 scrollbar-none">
              {tabs.map((tab) => (
                <TabBarItem
                  key={tab.id}
                  tab={tab}
                  isActive={tab.id === activeTabId}
                  canCloseOthers={tabs.length > 1}
                  onActivate={() => selectTab(tab.id)}
                  onClose={() => handleCloseTab(tab.id)}
                  onCloseOthers={() => handleCloseOthers(tab.id)}
                  onCloseAll={handleCloseAll}
                  onRename={(title) => renameTab(tab.id, title)}
                />
              ))}
            </div>

            <div className="flex-1 overflow-auto p-4 flex flex-col min-h-0 bg-surface">
              {activeTabId && <HttpClientRequestPanel key={activeTabId} tabId={activeTabId} />}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

interface TabBarItemProps {
  tab: PostmanTab;
  isActive: boolean;
  canCloseOthers: boolean;
  onActivate: () => void;
  onClose: () => void;
  onCloseOthers: () => void;
  onCloseAll: () => void;
  onRename: (title: string) => void;
}

const TabBarItem: React.FC<TabBarItemProps> = ({
  tab,
  isActive,
  canCloseOthers,
  onActivate,
  onClose,
  onCloseOthers,
  onCloseAll,
  onRename
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(tab.title);

  const startRenaming = (): void => {
    setDraftTitle(tab.title);
    setIsEditing(true);
  };

  const commitRename = (): void => {
    const trimmed = draftTitle.trim();
    if (trimmed && trimmed !== tab.title) onRename(trimmed);
    setIsEditing(false);
  };

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
    <ContextMenu.Root>
      <ContextMenu.Trigger
        render={
          <div
            onClick={onActivate}
            onDoubleClick={startRenaming}
            title="Double-click to rename · Right-click for more options"
            className={`flex items-center gap-2 px-3 border-r border-border-dark cursor-pointer text-xs transition-colors shrink-0 group ${
              isActive
                ? 'bg-editor-bg text-white border-t-2 border-t-accent'
                : 'bg-sidebar-bg text-zinc-550 hover:bg-editor-bg/40 hover:text-zinc-300'
            }`}
          >
            <FileText size={12} className={isActive ? 'text-accent' : 'text-zinc-600'} />
            <span className="truncate max-w-30">{tab.title}</span>
            {!tab.meta?.savedRequestId && (
              <span
                title="Not saved to a collection"
                className="size-1.5 rounded-full bg-amber-500 shrink-0"
              />
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              title="Close tab"
              className="p-0.5 rounded-full hover:bg-border-dark/65 text-zinc-555 group-hover:text-zinc-400 hover:text-white"
            >
              <X size={10} />
            </button>
          </div>
        }
      />
      <ContextMenu.Content>
        <ContextMenu.Item onClick={startRenaming}>Rename</ContextMenu.Item>
        <ContextMenu.Separator />
        <ContextMenu.Item onClick={onClose}>Close</ContextMenu.Item>
        <ContextMenu.Item onClick={onCloseOthers} disabled={!canCloseOthers}>
          Close Others
        </ContextMenu.Item>
        <ContextMenu.Item onClick={onCloseAll}>Close All</ContextMenu.Item>
      </ContextMenu.Content>
    </ContextMenu.Root>
  );
};

const HttpClientRequestPanel: React.FC<{ tabId: string }> = ({ tabId }) => {
  const client = useApiClient(tabId);
  const tab = usePostmanTabsStore((s) => s.tabs.find((t) => t.id === tabId));
  const renameTab = usePostmanTabsStore((s) => s.renameTab);
  const seed = tab?.meta as PostmanTabSeed | undefined;
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!saveError) return;
    const timer = setTimeout(() => setSaveError(null), 5000);
    return () => clearTimeout(timer);
  }, [saveError]);

  // Cmd/Ctrl+Enter to send, Cmd/Ctrl+S to quick-save a request already linked to a
  // collection (an unlinked tab still needs the Save popover to pick a destination).
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (!e.metaKey && !e.ctrlKey) return;
      if (e.key === 'Enter' && client.protocol === 'HTTP') {
        e.preventDefault();
        client.http.send();
      } else if (e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (client.protocol === 'HTTP' && client.binding) {
          useCollectionsStore
            .getState()
            .saveRequest(
              client.binding.collectionId,
              {
                id: client.binding.requestId,
                name: tab?.title ?? 'Untitled Request',
                method: client.http.state.method,
                url: client.http.state.url,
                headers: client.http.state.headers,
                params: client.http.state.params,
                bodyType: client.http.state.bodyType,
                body: client.http.state.body,
                updatedAt: Date.now()
              },
              null
            )
            .catch((err: unknown) => {
              setSaveError(err instanceof Error ? err.message : 'Save failed.');
            });
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [client, tab]);

  return (
    <div className="flex-1 flex flex-col gap-3 min-h-0">
      {saveError && (
        <div className="shrink-0 rounded px-2 py-1.5 text-[10px] leading-snug border bg-red-950/30 border-red-900/40 text-red-400">
          {saveError}
        </div>
      )}
      <Tabs.Root
        value={client.protocol}
        onValueChange={(value) => client.setProtocol(value as ProtocolTab)}
        className="flex flex-col gap-3 min-h-0 flex-1"
      >
        <nav className="flex items-center justify-between gap-2 shrink-0 border-b border-border-dark pb-2">
          <Tabs.List className="flex items-center gap-1">
            {PROTOCOL_ITEMS.map(({ value, label, icon: Icon }) => (
              <Tabs.Tab
                key={value}
                value={value}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium cursor-pointer transition-colors',
                  client.protocol === value
                    ? 'bg-accent/10 text-accent'
                    : 'text-zinc-500 hover:bg-editor-bg hover:text-zinc-300'
                )}
              >
                <Icon size={13} />
                {label}
              </Tabs.Tab>
            ))}
          </Tabs.List>

          <div className="flex items-center gap-2">
            <EnvironmentSelector />
            {client.protocol === 'HTTP' && (
              <>
                <CodeSnippetPopover
                  method={client.http.state.method}
                  url={client.http.state.url}
                  headers={client.http.state.headers}
                  bodyType={client.http.state.bodyType}
                  body={client.http.state.body}
                />
                <SaveRequestPopover
                  tabTitle={tab?.title ?? 'New API Request'}
                  method={client.http.state.method}
                  url={client.http.state.url}
                  headers={client.http.state.headers}
                  params={client.http.state.params}
                  bodyType={client.http.state.bodyType}
                  body={client.http.state.body}
                  binding={client.binding}
                  defaultCollectionId={seed?.defaultCollectionId}
                  defaultFolderId={seed?.defaultFolderId}
                  onSaved={(binding, name) => {
                    client.bindTo(binding);
                    renameTab(tabId, name);
                  }}
                />
              </>
            )}
          </div>
        </nav>

        <Tabs.Panel value="HTTP" className="flex flex-col gap-3 min-h-0 flex-1">
          <RequestComposer
            method={client.http.state.method}
            onMethodChange={client.http.setMethod}
            url={client.http.state.url}
            onUrlChange={client.http.setUrl}
            isLoading={client.http.state.isLoading}
            onSend={client.http.send}
          />

          <RequestEditorPanel
            params={client.http.state.params}
            onUpdateParam={client.http.updateParamRow}
            onRemoveParam={client.http.removeParamRow}
            headers={client.http.state.headers}
            onUpdateHeader={client.http.updateHeaderRow}
            onRemoveHeader={client.http.removeHeaderRow}
            bodyType={client.http.state.bodyType}
            onBodyTypeChange={client.http.setBodyType}
            body={client.http.state.body}
            onBodyChange={client.http.setBody}
          />

          <ResponseInspector
            response={client.http.state.response}
            isLoading={client.http.state.isLoading}
          />
        </Tabs.Panel>

        <Tabs.Panel value="WEBSOCKET" className="flex flex-col gap-3 min-h-0 flex-1">
          <WebSocketComposer
            url={client.ws.state.url}
            onUrlChange={client.ws.setUrl}
            status={client.ws.state.status}
            onConnect={client.ws.connect}
            onDisconnect={client.ws.disconnect}
            messageInput={client.ws.state.messageInput}
            onMessageInputChange={client.ws.setMessageInput}
            onSendMessage={client.ws.sendMessage}
          />

          <WebSocketLog log={client.ws.state.log} onClear={client.ws.clearLog} />
        </Tabs.Panel>
      </Tabs.Root>
    </div>
  );
};
