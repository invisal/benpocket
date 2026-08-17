import type React from 'react';
import { useEffect, useState } from 'react';
import { cn } from 'cnfast';
import { FolderPlus, Plus, Upload, Waves, X } from 'lucide-react';
import { Button } from '@renderer/components/ui/Button';
import { useRequestTabsStore, type RequestTab } from './store/tabs.store';
import { useCollectionsStore } from './store/collections.store';
import { useEnvironmentsStore } from './store/environments.store';
import { disposeApiClientTab } from './hooks/useApiClient';
import { WorkspaceSelector } from './components/WorkspaceSelector';
import { EnvironmentSelector } from './components/EnvironmentSelector';
import { CollectionsTree } from './components/CollectionsTree';
import { ContextMenu } from '@renderer/components/ui/ContextMenu';
import type {
  Collection,
  HttpMethod,
  SavedExample,
  SavedRequest
} from '../../../preload/http-client/types';
import type { RequestTabSeed } from './types';
import {
  collectAllFolderIds,
  countRequestsRecursive,
  findFolderChainForRequest
} from './lib/collectionTree';
import { methodBadgeClass } from './lib/methodBadge';

/** Method/protocol badge for an open tab, mirroring `RequestMethodBadge` in `CollectionsTree.tsx` but reading off the tab's seed data. */
const TabMethodBadge: React.FC<{ tab: RequestTab }> = ({ tab }) => {
  if (tab.meta?.protocol === 'WEBSOCKET') {
    return (
      <span
        title="WebSocket request"
        className={`flex items-center justify-center px-1 py-0.5 rounded shrink-0 ${methodBadgeClass('WEBSOCKET')}`}
      >
        <Waves size={9} strokeWidth={3} />
      </span>
    );
  }
  const method: HttpMethod = tab.meta?.method ?? 'GET';
  return (
    <span
      className={`text-[9px] font-medium px-1 py-0.5 rounded shrink-0 ${methodBadgeClass(method)}`}
    >
      {method}
    </span>
  );
};

interface OpenTabItemProps {
  tab: RequestTab;
  isActive: boolean;
  /** Shown in italic and reused by the next preview-mode open, VS Code-style. */
  isPreview: boolean;
  canCloseOthers: boolean;
  onActivate: () => void;
  onClose: () => void;
  onCloseOthers: () => void;
  onCloseAll: () => void;
  onRename: (title: string) => void;
  /** Promotes this tab out of preview mode into a permanent one. */
  onPin: () => void;
}

const OpenTabItem: React.FC<OpenTabItemProps> = ({
  tab,
  isActive,
  isPreview,
  canCloseOthers,
  onActivate,
  onClose,
  onCloseOthers,
  onCloseAll,
  onRename,
  onPin
}) => {
  const [isRenaming, setIsRenaming] = useState(false);
  const [draftTitle, setDraftTitle] = useState(tab.title);

  const startRenaming = (): void => {
    onPin();
    setDraftTitle(tab.title);
    setIsRenaming(true);
  };

  const commitRename = (): void => {
    setIsRenaming(false);
    const trimmed = draftTitle.trim();
    if (trimmed && trimmed !== tab.title) onRename(trimmed);
  };

  if (isRenaming) {
    return (
      <div className="flex items-center gap-2 p-1.5 rounded border border-accent bg-surface-3">
        <TabMethodBadge tab={tab} />
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
              setIsRenaming(false);
            }
          }}
          className="flex-1 bg-transparent text-xs text-zinc-200 focus:outline-none min-w-0"
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
            title={
              isPreview
                ? 'Preview tab · double-click to keep open, or edit the request'
                : 'Double-click to rename · Right-click for more options'
            }
            className={cn(
              'flex items-center gap-2 p-1.5 rounded text-xs cursor-pointer border transition-all group',
              isActive
                ? 'bg-list-selected border-transparent'
                : 'border-transparent hover:bg-list-hover hover:border-border-dark'
            )}
          >
            <TabMethodBadge tab={tab} />
            <span
              className={cn(
                'flex-1 truncate',
                isActive ? 'text-foreground' : 'text-zinc-300 group-hover:text-foreground',
                isPreview && 'italic'
              )}
            >
              {tab.title}
            </span>
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
              className="p-0.5 rounded-full hover:bg-border-dark/65 text-zinc-555 opacity-0 group-hover:opacity-100 hover:text-foreground shrink-0"
            >
              <X size={10} />
            </button>
          </div>
        }
      />
      <ContextMenu.Content>
        {isPreview && <ContextMenu.Item onClick={onPin}>Keep Tab Open</ContextMenu.Item>}
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

export const HttpClientSidebar: React.FC = () => {
  const {
    tabs,
    activeTabId,
    previewTabId,
    openTab,
    openNewRequestTab,
    setActiveTabId,
    closeTab,
    renameTab,
    pinTab
  } = useRequestTabsStore();
  const {
    collections,
    isLoaded,
    load,
    createCollection,
    renameCollection,
    deleteCollection,
    renameRequest,
    deleteRequest,
    renameExample,
    deleteExample,
    createFolder,
    renameFolder,
    deleteFolder,
    moveRequest,
    moveFolder,
    setCollectionAuth,
    setFolderAuth,
    exportCollection,
    importCollection
  } = useCollectionsStore();

  // Collections and folders default to collapsed; nothing auto-expands on load.
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [isCreatingCollection, setIsCreatingCollection] = useState(false);
  const [draftCollectionName, setDraftCollectionName] = useState('');
  const [statusMessage, setStatusMessage] = useState<{
    type: 'error' | 'success';
    text: string;
  } | null>(null);

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const activeCollectionId = activeTab?.meta?.savedCollectionId ?? null;
  const activeRequestId = activeTab?.meta?.savedRequestId ?? null;
  const activeExampleId = activeTab?.meta?.savedExampleId ?? null;

  // When the active tab switches to point at a (different) saved request, reveal it
  // in the tree by expanding its collection and folder chain, so the user can always
  // see where the currently selected tab lives. Adjusted directly during render
  // (rather than in an effect) so it applies before paint; guarded by `lastRevealedRequestId`
  // so it only reacts to the active request genuinely changing, not to the user
  // manually re-collapsing a folder on that path afterwards.
  const [lastRevealedRequestId, setLastRevealedRequestId] = useState<string | null>(null);
  if (activeRequestId && activeRequestId !== lastRevealedRequestId) {
    setLastRevealedRequestId(activeRequestId);
    const collection = collections.find((c) => c.id === activeCollectionId);
    const chain = collection ? findFolderChainForRequest(collection, activeRequestId) : null;
    if (collection && chain) {
      setExpanded((prev) => {
        const next = new Set(prev);
        next.add(collection.id);
        for (const id of chain) next.add(id);
        return next;
      });
    }
  }

  useEffect(() => {
    if (!isLoaded) load();
  }, [isLoaded, load]);

  useEffect(() => {
    if (!statusMessage) return;
    const timer = setTimeout(() => setStatusMessage(null), 5000);
    return () => clearTimeout(timer);
  }, [statusMessage]);

  const handleNewRequestTab = (): void => {
    openNewRequestTab({ method: 'GET', url: '' });
  };

  const openNewRequestInFolder = (collectionId: string, folderId: string | null): void => {
    openNewRequestTab({
      method: 'GET',
      url: '',
      defaultCollectionId: collectionId,
      defaultFolderId: folderId
    });
  };

  const openSavedRequest = (
    collection: Collection,
    request: SavedRequest,
    options?: { preview?: boolean }
  ): void => {
    const preview = options?.preview ?? true;
    const tabId = `request-saved-${collection.id}-${request.id}`;
    const seed: RequestTabSeed =
      request.protocol === 'WEBSOCKET'
        ? {
            protocol: 'WEBSOCKET',
            wsUrl: request.url,
            savedCollectionId: collection.id,
            savedRequestId: request.id
          }
        : {
            protocol: 'HTTP',
            method: request.method,
            url: request.url,
            headers: request.headers,
            params: request.params,
            bodyType: request.bodyType,
            body: request.body,
            auth: request.auth,
            savedCollectionId: collection.id,
            savedRequestId: request.id
          };
    // Single-click opens in preview mode (a VS Code-style italic tab that gets
    // reused/replaced by the next preview click, until the user edits it, pins it, or
    // double-clicks it in the sidebar to open it permanently right away).
    const { replacedTabId } = openTab(
      {
        id: tabId,
        title: request.name,
        meta: seed
      },
      { preview }
    );
    if (replacedTabId && replacedTabId !== tabId) disposeApiClientTab(replacedTabId);
  };

  /**
   * Opens a saved example: preloads the request fields and the captured response into a
   * tab without sending. Deliberately left unbound (no `savedCollectionId`/`savedRequestId`
   * in the seed) so editing it and hitting Ctrl+S opens the full Save dialog rather than
   * silently overwriting the parent request.
   */
  const openSavedExample = (
    collection: Collection,
    request: SavedRequest,
    example: SavedExample,
    options?: { preview?: boolean }
  ): void => {
    const preview = options?.preview ?? true;
    const tabId = `request-example-${collection.id}-${request.id}-${example.id}`;
    const seed: RequestTabSeed = {
      protocol: 'HTTP',
      method: example.request.method,
      url: example.request.url,
      headers: example.request.headers,
      params: example.request.params,
      bodyType: example.request.bodyType,
      body: example.request.body,
      auth: example.request.auth,
      response: example.response,
      savedExampleId: example.id
    };
    const { replacedTabId } = openTab(
      {
        id: tabId,
        title: `${request.name} · ${example.name}`,
        meta: seed
      },
      { preview }
    );
    if (replacedTabId && replacedTabId !== tabId) disposeApiClientTab(replacedTabId);
  };

  /** Runs a store mutation and surfaces a failure in the status banner instead of letting it fail silently. */
  const runMutation = async (fn: () => Promise<unknown>): Promise<void> => {
    try {
      await fn();
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Something went wrong.'
      });
    }
  };

  const submitNewCollection = (): void => {
    const name = draftCollectionName.trim();
    setIsCreatingCollection(false);
    setDraftCollectionName('');
    if (name) runMutation(() => createCollection(name));
  };

  const handleImportCollection = async (): Promise<void> => {
    const result = await importCollection();
    if (result.canceled) return;
    if (!result.ok) {
      setStatusMessage({ type: 'error', text: result.error ?? 'Import failed.' });
    } else if (result.collection) {
      // Expand the collection and every folder in it, recursively, so a freshly
      // imported tree is fully visible without the user having to click every chevron.
      setExpanded((prev) => {
        const next = new Set(prev);
        next.add(result.collection!.id);
        for (const folderId of collectAllFolderIds(result.collection!)) next.add(folderId);
        return next;
      });
      const versionLabel =
        result.schemaVersion && result.schemaVersion !== 'unknown'
          ? result.sourceFormat === 'openapi'
            ? ` (OpenAPI ${result.schemaVersion})`
            : ` (Collection v${result.schemaVersion})`
          : '';
      const variablesLabel = result.importedVariableCount
        ? `, ${result.importedVariableCount} variable${result.importedVariableCount === 1 ? '' : 's'}`
        : '';
      setStatusMessage({
        type: 'success',
        text: `Imported "${result.collection.name}" (${countRequestsRecursive(result.collection)} requests${variablesLabel})${versionLabel}.`
      });
      if (result.environmentId) {
        await useEnvironmentsStore.getState().load();
        useEnvironmentsStore.getState().setActiveEnvironmentId(result.environmentId);
      }
    }
  };

  const handleExportCollection = async (collectionId: string): Promise<void> => {
    const result = await exportCollection(collectionId);
    if (result.canceled) return;
    setStatusMessage(
      result.ok
        ? { type: 'success', text: 'Collection exported.' }
        : { type: 'error', text: result.error ?? 'Export failed.' }
    );
  };

  const handleInvalidDrop = (text: string): void => {
    setStatusMessage({ type: 'error', text });
  };

  const handleCloseTab = (id: string): void => {
    closeTab(id);
    disposeApiClientTab(id);
  };

  const handleCloseOtherTabs = (keepId: string): void => {
    for (const t of tabs) {
      if (t.id !== keepId) handleCloseTab(t.id);
    }
  };

  const handleCloseAllTabs = (): void => {
    for (const t of tabs) handleCloseTab(t.id);
  };

  return (
    <div className="flex flex-col min-h-full">
      <div className="flex flex-col flex-1">
        <div className="flex items-center justify-between border-b border-border px-2 py-1">
          <WorkspaceSelector />
          <Button variant="ghost" size="sm" onClick={handleNewRequestTab} title="Create Request">
            <Plus size={16} />
          </Button>
        </div>

        {tabs.length > 0 && (
          <div className="flex flex-col gap-1.5 px-2">
            <div className="flex items-center justify-between mt-2">
              <span className="text-[10px] font-semibold text-zinc-500">OPEN TABS</span>
            </div>
            <div className="flex flex-col gap-0.5">
              {tabs.map((tab) => (
                <OpenTabItem
                  key={tab.id}
                  tab={tab}
                  isActive={tab.id === activeTabId}
                  isPreview={tab.id === previewTabId}
                  canCloseOthers={tabs.length > 1}
                  onActivate={() => setActiveTabId(tab.id)}
                  onClose={() => handleCloseTab(tab.id)}
                  onCloseOthers={() => handleCloseOtherTabs(tab.id)}
                  onCloseAll={handleCloseAllTabs}
                  onRename={(title) => renameTab(tab.id, title)}
                  onPin={() => pinTab(tab.id)}
                />
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-1.5 px-2">
          <div className="flex items-center justify-between mt-2">
            <span className="text-[10px] font-semibold text-zinc-500">COLLECTIONS</span>
            <div className="flex items-center gap-0.5">
              <button
                onClick={handleImportCollection}
                title="Import Collection — supports Postman Collection v2.0/v2.1 and OpenAPI v3.0/v3.1 (.json, .yaml, .yml)"
                className="p-1 text-zinc-500 hover:text-foreground hover:bg-border-dark/60 rounded cursor-pointer transition-colors"
              >
                <Upload size={13} />
              </button>
              <button
                onClick={() => {
                  setIsCreatingCollection(true);
                  setDraftCollectionName('');
                }}
                title="New Collection"
                className="p-1 text-zinc-500 hover:text-foreground hover:bg-border-dark/60 rounded cursor-pointer transition-colors"
              >
                <FolderPlus size={13} />
              </button>
            </div>
          </div>

          {statusMessage && (
            <div
              className={`flex items-start justify-between gap-2 rounded px-2 py-1.5 text-[10px] leading-snug border ${
                statusMessage.type === 'error'
                  ? 'bg-red-500/10 border-red-500/20 text-red-400'
                  : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
              }`}
            >
              <span>{statusMessage.text}</span>
              <button
                onClick={() => setStatusMessage(null)}
                title="Dismiss"
                className="shrink-0 cursor-pointer hover:opacity-70"
              >
                <X size={11} />
              </button>
            </div>
          )}

          {isCreatingCollection && (
            <input
              type="text"
              autoFocus
              placeholder="Collection name..."
              value={draftCollectionName}
              onChange={(e) => setDraftCollectionName(e.target.value)}
              onBlur={submitNewCollection}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitNewCollection();
                if (e.key === 'Escape') {
                  setIsCreatingCollection(false);
                  setDraftCollectionName('');
                }
              }}
              className="bg-surface-3 border border-accent rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none"
            />
          )}

          {collections.length === 0 && !isCreatingCollection && (
            <div className="text-[11px] text-zinc-650 italic px-1 py-1 leading-relaxed">
              No collections yet. Collections group related saved requests together, so you can find
              and re-run them later. Save a request, or import a collection (v2.0 / v2.1 .json).
            </div>
          )}

          <CollectionsTree
            collections={collections}
            expanded={expanded}
            onExpandedChange={setExpanded}
            activeCollectionId={activeCollectionId}
            activeRequestId={activeRequestId}
            activeExampleId={activeExampleId}
            onOpenRequest={(collection, request, options) =>
              openSavedRequest(collection, request, options)
            }
            onOpenExample={(collection, request, example, options) =>
              openSavedExample(collection, request, example, options)
            }
            onNewRequest={(collectionId, folderId) =>
              openNewRequestInFolder(collectionId, folderId)
            }
            onRenameCollection={(collectionId, name) =>
              runMutation(() => renameCollection(collectionId, name))
            }
            onDeleteCollection={(collectionId) => runMutation(() => deleteCollection(collectionId))}
            onExportCollection={(collectionId) => handleExportCollection(collectionId)}
            onSetCollectionAuth={(collectionId, auth) => setCollectionAuth(collectionId, auth)}
            onCreateFolder={(collectionId, parentFolderId, name) =>
              runMutation(() => createFolder(collectionId, parentFolderId, name))
            }
            onRenameFolder={(collectionId, folderId, name) =>
              runMutation(() => renameFolder(collectionId, folderId, name))
            }
            onDeleteFolder={(collectionId, folderId) =>
              runMutation(() => deleteFolder(collectionId, folderId))
            }
            onMoveFolder={(collectionId, folderId, targetParentFolderId) =>
              runMutation(() => moveFolder(collectionId, folderId, targetParentFolderId))
            }
            onSetFolderAuth={(collectionId, folderId, auth) =>
              setFolderAuth(collectionId, folderId, auth)
            }
            onRenameRequest={(collectionId, requestId, name) =>
              runMutation(() => renameRequest(collectionId, requestId, name))
            }
            onDeleteRequest={(collectionId, requestId) =>
              runMutation(() => deleteRequest(collectionId, requestId))
            }
            onMoveRequest={(collectionId, requestId, targetFolderId) =>
              runMutation(() => moveRequest(collectionId, requestId, targetFolderId))
            }
            onRenameExample={(collectionId, requestId, exampleId, name) =>
              runMutation(() => renameExample(collectionId, requestId, exampleId, name))
            }
            onDeleteExample={(collectionId, requestId, exampleId) =>
              runMutation(() => deleteExample(collectionId, requestId, exampleId))
            }
            onInvalidDrop={handleInvalidDrop}
          />
        </div>
      </div>

      <EnvironmentSelector />
    </div>
  );
};
