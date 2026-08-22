import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { Plug, PlugZap, RefreshCw, Send } from 'lucide-react';
import { useRequestTabsStore } from './store/tabs.store';
import { useEnvironmentsStore } from './store/environments.store';
import { useWorkspacesStore } from './store/workspaces.store';
import { useCollectionsStore } from './store/collections.store';
import { HttpClientSidebar } from './HttpClientSidebar';
import { useApiClient } from './hooks/useApiClient';
import type { RequestTabSeed } from './types';
import { RequestComposer } from './components/RequestComposer';
import { RequestEditorPanel } from './components/RequestEditorPanel';
import { ResponseInspector } from './components/ResponseInspector';
import { WebSocketComposer } from './components/WebSocketComposer';
import { WebSocketLog } from './components/WebSocketLog';
import { SaveRequestButton, type SaveRequestButtonHandle } from './components/SaveRequestButton';
import { CodeSnippetDrawer } from './components/CodeSnippetDrawer';
import { ResizablePanel } from '@renderer/components/ui/ResizablePanel';

const RESPONSE_PANEL_HEIGHT_KEY = 'craftbox-http-client-response-height';
const DEFAULT_RESPONSE_PANEL_HEIGHT = 40;
const WS_LOG_HEIGHT_KEY = 'craftbox-http-client-ws-log-height';
const DEFAULT_WS_LOG_HEIGHT = 50;
const SIDEBAR_WIDTH_KEY = 'craftbox-http-client-sidebar-width';
const DEFAULT_SIDEBAR_WIDTH = 256;

function readStoredResponsePanelHeight(): number {
  const stored = window.localStorage.getItem(RESPONSE_PANEL_HEIGHT_KEY);
  const parsed = stored ? Number(stored) : NaN;
  return Number.isFinite(parsed) ? parsed : DEFAULT_RESPONSE_PANEL_HEIGHT;
}

function readStoredWsLogHeight(): number {
  const stored = window.localStorage.getItem(WS_LOG_HEIGHT_KEY);
  const parsed = stored ? Number(stored) : NaN;
  return Number.isFinite(parsed) ? parsed : DEFAULT_WS_LOG_HEIGHT;
}

function readStoredSidebarWidth(): number {
  const stored = window.localStorage.getItem(SIDEBAR_WIDTH_KEY);
  const parsed = stored ? Number(stored) : NaN;
  return Number.isFinite(parsed) ? parsed : DEFAULT_SIDEBAR_WIDTH;
}

/**
 * HTTP Client's own sidebar + request-tab system, entirely self-contained so it
 * no longer depends on the app's global left panel / tool-tab switcher (both of
 * which were replaced by `ToolTabContents` and only manage the top-level tool
 * tabs, not this tool's internal request tabs).
 */
export const HttpClientWorkspace: React.FC = () => {
  const tabs = useRequestTabsStore((s) => s.tabs);
  const activeTabId = useRequestTabsStore((s) => s.activeTabId);
  const openNewRequestTab = useRequestTabsStore((s) => s.openNewRequestTab);

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

  const [sidebarWidth, setSidebarWidth] = useState<number>(readStoredSidebarWidth);
  const handleSidebarResize = (size: number): void => {
    setSidebarWidth(size);
    window.localStorage.setItem(SIDEBAR_WIDTH_KEY, String(size));
  };

  return (
    <div className="flex flex-1 min-h-0">
      <ResizablePanel
        edge="right"
        size={sidebarWidth}
        onResize={handleSidebarResize}
        min={200}
        max={480}
        className="bg-surface border-r border-border-light overflow-y-auto"
      >
        <HttpClientSidebar />
      </ResizablePanel>

      <div className="flex-1 min-w-0 flex flex-col min-h-0">
        {tabs.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 select-none text-center">
            <div className="text-zinc-550 text-sm font-semibold">No request open</div>
            <div className="text-zinc-655 text-xs">
              Create a request from the sidebar to get started.
            </div>
            <button
              onClick={() => openNewRequestTab()}
              className="mt-1 px-3 py-1.5 bg-surface-2 border border-border-dark hover:bg-border-dark/50 rounded text-xs text-zinc-300 hover:text-foreground cursor-pointer transition-all"
            >
              New Request
            </button>
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0 bg-surface">
            {activeTabId && <HttpClientRequestPanel key={activeTabId} tabId={activeTabId} />}
          </div>
        )}
      </div>
    </div>
  );
};

const HttpClientRequestPanel: React.FC<{ tabId: string }> = ({ tabId }) => {
  const tab = useRequestTabsStore((s) => s.tabs.find((t) => t.id === tabId));
  const isPreviewTab = useRequestTabsStore((s) => s.previewTabId === tabId);
  const pinTab = useRequestTabsStore((s) => s.pinTab);
  // Editing a preview tab's request promotes it to a permanent tab, same as VS Code:
  // previewing is read-only in spirit, and any real edit means the user wants to keep working here.
  const pinIfPreview = (): void => {
    if (isPreviewTab) pinTab(tabId);
  };
  const client = useApiClient(tabId, { onEdit: pinIfPreview });
  const seed = tab?.meta as RequestTabSeed | undefined;
  const [saveError, setSaveError] = useState<string | null>(null);
  const saveButtonRef = useRef<SaveRequestButtonHandle>(null);
  const [responsePanelHeight, setResponsePanelHeight] = useState<number>(
    readStoredResponsePanelHeight
  );
  const handleResponsePanelResize = (size: number): void => {
    setResponsePanelHeight(size);
    window.localStorage.setItem(RESPONSE_PANEL_HEIGHT_KEY, String(size));
  };
  const [wsLogHeight, setWsLogHeight] = useState<number>(readStoredWsLogHeight);
  const handleWsLogResize = (size: number): void => {
    setWsLogHeight(size);
    window.localStorage.setItem(WS_LOG_HEIGHT_KEY, String(size));
  };

  useEffect(() => {
    if (!saveError) return;
    const timer = setTimeout(() => setSaveError(null), 5000);
    return () => clearTimeout(timer);
  }, [saveError]);

  // Cmd/Ctrl+Enter to send, Cmd/Ctrl+S to save (same action the visible Save button runs),
  // Cmd/Ctrl+Z to undo and Cmd/Ctrl+Shift+Z or Ctrl+Y to redo the last HTTP draft edit.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (!e.metaKey && !e.ctrlKey) return;
      const key = e.key.toLowerCase();
      if (e.key === 'Enter' && client.protocol === 'HTTP') {
        e.preventDefault();
        client.http.send();
      } else if (key === 's') {
        e.preventDefault();
        saveButtonRef.current?.save();
      } else if (client.protocol === 'HTTP' && (key === 'z' || key === 'y')) {
        e.preventDefault();
        if (key === 'y' || (key === 'z' && e.shiftKey)) client.http.redo();
        else client.http.undo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [client]);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {saveError && (
        <div className="shrink-0 rounded px-2 py-1.5 text-[10px] leading-snug border bg-red-500/10 border-red-500/20 text-red-400">
          {saveError}
        </div>
      )}

      <div className="flex flex-col min-h-0 flex-1">
        <RequestComposer
          method={client.protocol === 'WEBSOCKET' ? 'WEBSOCKET' : client.http.state.method}
          onMethodChange={(value) => {
            if (value === 'WEBSOCKET') {
              pinIfPreview();
              client.setProtocol('WEBSOCKET');
            } else {
              client.setProtocol('HTTP');
              client.http.setMethod(value);
            }
          }}
          url={client.protocol === 'WEBSOCKET' ? client.ws.state.url : client.http.state.url}
          onUrlChange={(url) => {
            if (client.protocol === 'WEBSOCKET') client.ws.setUrl(url);
            else client.http.setUrl(url);
          }}
          urlDisabled={
            client.protocol === 'WEBSOCKET' &&
            (client.ws.state.status === 'CONNECTED' || client.ws.state.status === 'CONNECTING')
          }
          onImportCurl={client.protocol === 'HTTP' ? client.http.importCurl : undefined}
          extraActions={
            <>
              {client.protocol === 'HTTP' && (
                <CodeSnippetDrawer request={client.http.state} binding={client.binding} />
              )}
              <SaveRequestButton
                ref={saveButtonRef}
                tabTitle={tab?.title ?? 'New API Request'}
                protocol={client.protocol}
                url={client.protocol === 'HTTP' ? client.http.state.url : client.ws.state.url}
                request={client.protocol === 'HTTP' ? client.http.state : undefined}
                binding={client.binding}
                defaultCollectionId={seed?.defaultCollectionId}
                onSaved={client.bindTo}
                onError={setSaveError}
              />
            </>
          }
          action={
            client.protocol === 'WEBSOCKET'
              ? {
                  label:
                    client.ws.state.status === 'CONNECTING'
                      ? 'Connecting...'
                      : client.ws.state.status === 'CONNECTED'
                        ? 'Disconnect'
                        : 'Connect',
                  icon:
                    client.ws.state.status === 'CONNECTING' ? (
                      <RefreshCw size={13} className="animate-spin" />
                    ) : client.ws.state.status === 'CONNECTED' ? (
                      <PlugZap size={13} />
                    ) : (
                      <Plug size={13} />
                    ),
                  onClick:
                    client.ws.state.status === 'CONNECTED'
                      ? client.ws.disconnect
                      : client.ws.connect,
                  disabled:
                    client.ws.state.status === 'CONNECTING' ||
                    (client.ws.state.status !== 'CONNECTED' && !client.ws.state.url.trim()),
                  className:
                    client.ws.state.status === 'CONNECTED'
                      ? '!bg-danger hover:!bg-danger/80'
                      : undefined
                }
              : {
                  label: client.http.state.isLoading ? 'Sending...' : 'Send',
                  icon: client.http.state.isLoading ? (
                    <RefreshCw size={13} className="animate-spin" />
                  ) : (
                    <Send size={13} />
                  ),
                  onClick: client.http.send,
                  disabled: client.http.state.isLoading
                }
          }
        />

        {client.protocol === 'HTTP' ? (
          <>
            <div className="flex-1 min-h-0 flex flex-col gap-3 mt-3">
              <RequestEditorPanel http={client.http} binding={client.binding} />
            </div>

            <ResizablePanel
              edge="top"
              size={responsePanelHeight}
              onResize={handleResponsePanelResize}
              min={15}
              max={75}
              unit="%"
              className="flex flex-col min-h-0"
            >
              <ResponseInspector
                response={client.http.state.response}
                isLoading={client.http.state.isLoading}
                binding={client.binding}
                request={client.http.state}
              />
            </ResizablePanel>
          </>
        ) : (
          <>
            <div className="flex-1 min-h-0 flex flex-col gap-3 mt-3">
              <WebSocketComposer
                messageInput={client.ws.state.messageInput}
                onMessageInputChange={client.ws.setMessageInput}
                onSendMessage={client.ws.sendMessage}
                disabled={client.ws.state.status !== 'CONNECTED'}
              />
            </div>

            <ResizablePanel
              edge="top"
              size={wsLogHeight}
              onResize={handleWsLogResize}
              min={15}
              max={75}
              unit="%"
              className="flex flex-col min-h-0"
            >
              <WebSocketLog
                log={client.ws.state.log}
                status={client.ws.state.status}
                onClear={client.ws.clearLog}
              />
            </ResizablePanel>
          </>
        )}
      </div>
    </div>
  );
};
