import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Popover } from '@base-ui/react/popover';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Folder,
  FolderOpen,
  FolderPlus,
  Move,
  MoreHorizontal,
  Pencil,
  Plus,
  Send,
  Trash2,
  Upload,
  Waves,
  X
} from 'lucide-react';
import { usePostmanTabsStore } from './store/tabs.store';
import { useCollectionsStore } from './store/collections.store';
import { WorkspaceSelector } from './components/WorkspaceSelector';
import type {
  Collection,
  CollectionFolder,
  SavedRequest
} from '../../../preload/http-client/types';
import type { PostmanTabSeed } from './types';
import {
  collectAllFolderIds,
  countRequestsRecursive,
  findFolderById,
  findFolderChainForRequest,
  findRequestInContainer,
  flattenFolderOptions,
  isFolderOrDescendant
} from './lib/collectionTree';

/** Custom MIME type carrying the drag payload for sidebar folder/request drag & drop. */
const DRAG_MIME_TYPE = 'application/x-craftbox-postman-item';

interface DragPayload {
  kind: 'request' | 'folder';
  id: string;
  collectionId: string;
}

function readDragPayload(dataTransfer: DataTransfer): DragPayload | null {
  const raw = dataTransfer.getData(DRAG_MIME_TYPE);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as DragPayload;
  } catch {
    return null;
  }
}

// Bordered so the badge still reads as a distinct chip against a light-theme
// surface, where the `-950` fill alone blends into near-white; the border
// pins the shape while the fill/text colors do the rest (`--color-purple-400`
// gets a light-theme override in main.css since its default is too washed out
// on a white background).
function methodBadgeClass(method: string): string {
  switch (method) {
    case 'WEBSOCKET':
      return 'text-cyan-500';
    case 'GET':
      return 'text-emerald-500';
    case 'POST':
      return 'text-amber-500';
    case 'PUT':
      return 'text-sky-500';
    case 'PATCH':
      return 'text-purple-400';
    case 'DELETE':
      return 'text-red-500';
    default:
      return 'text-zinc-400';
  }
}

/** Method/protocol badge for a saved request: the HTTP verb, or a WebSocket icon for WS requests. */
const RequestMethodBadge: React.FC<{ request: SavedRequest }> = ({ request }) => {
  if (request.protocol === 'WEBSOCKET') {
    return (
      <span
        title="WebSocket request"
        className={`flex items-center justify-center px-1 py-0.5 rounded shrink-0 ${methodBadgeClass('WEBSOCKET')}`}
      >
        <Waves size={9} strokeWidth={3} />
      </span>
    );
  }
  return (
    <span
      className={`text-[9px] font-extrabold px-1 py-0.5 rounded shrink-0 ${methodBadgeClass(request.method)}`}
    >
      {request.method}
    </span>
  );
};

export const HttpClientSidebar: React.FC = () => {
  const { tabs, activeTabId, openTab, openNewRequestTab } = usePostmanTabsStore();
  const {
    collections,
    isLoaded,
    load,
    createCollection,
    renameCollection,
    deleteCollection,
    renameRequest,
    deleteRequest,
    createFolder,
    renameFolder,
    deleteFolder,
    moveRequest,
    moveFolder,
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

  const handleNewPostmanRequest = (): void => {
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

  const openSavedRequest = (collection: Collection, request: SavedRequest): void => {
    const tabId = `postman-saved-${collection.id}-${request.id}`;
    const seed: PostmanTabSeed =
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
            savedCollectionId: collection.id,
            savedRequestId: request.id
          };
    openTab({
      id: tabId,
      title: request.name,
      meta: seed
    });
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

  const toggleExpanded = (id: string): void => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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
          ? ` (Postman Collection v${result.schemaVersion})`
          : '';
      setStatusMessage({
        type: 'success',
        text: `Imported "${result.collection.name}" (${countRequestsRecursive(result.collection)} requests)${versionLabel}.`
      });
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

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <WorkspaceSelector />
        <button
          onClick={handleNewPostmanRequest}
          title="Create Request"
          className="p-1 text-zinc-400 hover:text-white hover:bg-border-dark/60 rounded cursor-pointer transition-colors"
        >
          <Plus size={16} />
        </button>
      </div>

      <button
        onClick={handleNewPostmanRequest}
        className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-editor-bg border border-border-dark hover:bg-border-dark/50 rounded text-xs text-zinc-300 hover:text-white cursor-pointer transition-all"
      >
        <Send size={12} className="text-zinc-500" />
        <span>New Request</span>
      </button>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between mt-2">
          <span className="text-[10px] font-semibold text-zinc-500">COLLECTIONS</span>
          <div className="flex items-center gap-0.5">
            <button
              onClick={handleImportCollection}
              title="Import Postman Collection — supports Collection Format v2.0 and v2.1 (.json)"
              className="p-1 text-zinc-500 hover:text-white hover:bg-border-dark/60 rounded cursor-pointer transition-colors"
            >
              <Upload size={13} />
            </button>
            <button
              onClick={() => {
                setIsCreatingCollection(true);
                setDraftCollectionName('');
              }}
              title="New Collection"
              className="p-1 text-zinc-500 hover:text-white hover:bg-border-dark/60 rounded cursor-pointer transition-colors"
            >
              <FolderPlus size={13} />
            </button>
          </div>
        </div>

        {statusMessage && (
          <div
            className={`flex items-start justify-between gap-2 rounded px-2 py-1.5 text-[10px] leading-snug border ${
              statusMessage.type === 'error'
                ? 'bg-red-950/30 border-red-900/40 text-red-400'
                : 'bg-emerald-950/30 border-emerald-900/40 text-emerald-400'
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
            className="bg-editor-bg border border-accent rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none"
          />
        )}

        {collections.length === 0 && !isCreatingCollection && (
          <div className="text-[11px] text-zinc-650 italic px-1 py-1 leading-relaxed">
            No collections yet. Collections group related saved requests together, so you can find
            and re-run them later. Save a request, or import a Postman collection (v2.0 / v2.1
            .json).
          </div>
        )}

        <div className="flex flex-col gap-0.5">
          {collections.map((collection) => (
            <CollectionItem
              key={collection.id}
              collection={collection}
              expanded={expanded}
              isExpanded={expanded.has(collection.id)}
              onToggle={() => toggleExpanded(collection.id)}
              onToggleFolder={toggleExpanded}
              onRename={(name) => runMutation(() => renameCollection(collection.id, name))}
              onDelete={() => runMutation(() => deleteCollection(collection.id))}
              onExport={() => handleExportCollection(collection.id)}
              onOpenRequest={(request) => openSavedRequest(collection, request)}
              onRenameRequest={(requestId, name) =>
                runMutation(() => renameRequest(collection.id, requestId, name))
              }
              onDeleteRequest={(requestId) =>
                runMutation(() => deleteRequest(collection.id, requestId))
              }
              onMoveRequest={(requestId, targetFolderId) =>
                runMutation(() => moveRequest(collection.id, requestId, targetFolderId))
              }
              onNewRequest={(folderId) => openNewRequestInFolder(collection.id, folderId)}
              onCreateFolder={(parentFolderId, name) =>
                runMutation(() => createFolder(collection.id, parentFolderId, name))
              }
              onRenameFolder={(folderId, name) =>
                runMutation(() => renameFolder(collection.id, folderId, name))
              }
              onDeleteFolder={(folderId) =>
                runMutation(() => deleteFolder(collection.id, folderId))
              }
              onMoveFolder={(folderId, targetParentFolderId) =>
                runMutation(() => moveFolder(collection.id, folderId, targetParentFolderId))
              }
              onInvalidDrop={handleInvalidDrop}
              activeRequestId={activeCollectionId === collection.id ? activeRequestId : null}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

interface MenuButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}

const MenuButton: React.FC<MenuButtonProps> = ({ icon, label, onClick, danger }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-2 text-left px-2 py-1.5 rounded hover:bg-editor-bg cursor-pointer ${
      danger ? 'text-red-400 hover:text-red-300' : 'text-zinc-300 hover:text-white'
    }`}
  >
    {icon}
    <span className="truncate">{label}</span>
  </button>
);

interface ActionsMenuAction {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}

interface ActionsMenuMoveTarget {
  /** The whole collection's root folder tree — options are computed across all of it, not just siblings. */
  folders: CollectionFolder[];
  /** Exclude this folder (and its descendants) from the target list — used when moving a folder itself. */
  excludeId?: string;
  onSelect: (targetFolderId: string | null) => void;
}

interface ActionsMenuProps {
  actions: ActionsMenuAction[];
  moveTo?: ActionsMenuMoveTarget;
  triggerTitle?: string;
  triggerClassName?: string;
}

/**
 * A single "..." trigger that pops open a stacked menu of actions for a collection, folder or
 * request item, instead of a row of always-competing hover icons.
 *
 * Owns the `hidden group-hover:flex` reveal-on-hover wrapper itself (rather than leaving it to the
 * caller) because it must force itself visible while the popover is open: the popup renders in a
 * portal outside the hovered row, so moving the mouse into the popup drops the row's `:hover`. If
 * the trigger were still `display:none` at that point, its bounding rect would collapse to
 * (0,0) and the floating-positioned popup would jump to the top-left corner mid-interaction.
 */
const ActionsMenu: React.FC<ActionsMenuProps> = ({
  actions,
  moveTo,
  triggerTitle = 'More actions',
  triggerClassName = 'p-0.5 text-zinc-555 hover:text-white cursor-pointer'
}) => {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<'menu' | 'move'>('menu');
  const moveOptions = useMemo(
    () => (moveTo ? flattenFolderOptions(moveTo.folders, 0, moveTo.excludeId) : []),
    [moveTo]
  );

  const close = (): void => {
    setOpen(false);
    setView('menu');
  };

  return (
    <div
      className={`items-center shrink-0 ${open ? 'flex' : 'hidden group-hover:flex'}`}
      onClick={(e) => e.stopPropagation()}
      draggable={false}
    >
      <Popover.Root
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setView('menu');
        }}
      >
        <Popover.Trigger title={triggerTitle} className={triggerClassName}>
          <MoreHorizontal size={13} />
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner sideOffset={4} align="start" className="z-50">
            <Popover.Popup
              onClick={(e) => e.stopPropagation()}
              className="bg-sidebar-bg border border-border-dark rounded-lg shadow-xl p-1 w-48 max-h-72 overflow-y-auto flex flex-col gap-0.5 text-xs outline-none"
            >
              {view === 'menu' ? (
                <>
                  {actions.map((action) => (
                    <MenuButton
                      key={action.label}
                      icon={action.icon}
                      label={action.label}
                      danger={action.danger}
                      onClick={() => {
                        close();
                        action.onClick();
                      }}
                    />
                  ))}
                  {moveTo && (
                    <MenuButton
                      icon={<Move size={12} />}
                      label="Move to..."
                      onClick={() => setView('move')}
                    />
                  )}
                </>
              ) : (
                <>
                  <button
                    onClick={() => setView('menu')}
                    className="flex items-center gap-1 text-left px-2 py-1.5 rounded hover:bg-editor-bg text-zinc-400 hover:text-white cursor-pointer"
                  >
                    <ChevronLeft size={12} />
                    <span>Back</span>
                  </button>
                  <div className="h-px bg-border-dark my-0.5" />
                  <button
                    onClick={() => {
                      close();
                      moveTo!.onSelect(null);
                    }}
                    className="text-left px-2 py-1.5 rounded hover:bg-editor-bg text-zinc-300 hover:text-white cursor-pointer"
                  >
                    Collection Root
                  </button>
                  {moveOptions.map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => {
                        close();
                        moveTo!.onSelect(opt.id);
                      }}
                      style={{ paddingLeft: 8 + opt.depth * 12 }}
                      className="text-left px-2 py-1.5 rounded hover:bg-editor-bg text-zinc-300 hover:text-white cursor-pointer truncate"
                    >
                      {opt.name}
                    </button>
                  ))}
                  {moveOptions.length === 0 && (
                    <div className="px-2 py-1.5 text-zinc-600 italic">No other folders</div>
                  )}
                </>
              )}
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
};

interface CollectionItemProps {
  collection: Collection;
  expanded: Set<string>;
  isExpanded: boolean;
  onToggle: () => void;
  onToggleFolder: (folderId: string) => void;
  onRename: (name: string) => void;
  onDelete: () => void;
  onExport: () => void;
  onOpenRequest: (request: SavedRequest) => void;
  onRenameRequest: (requestId: string, name: string) => void;
  onDeleteRequest: (requestId: string) => void;
  onMoveRequest: (requestId: string, targetFolderId: string | null) => void;
  onNewRequest: (folderId: string | null) => void;
  onCreateFolder: (parentFolderId: string | null, name: string) => void;
  onRenameFolder: (folderId: string, name: string) => void;
  onDeleteFolder: (folderId: string) => void;
  onMoveFolder: (folderId: string, targetParentFolderId: string | null) => void;
  onInvalidDrop: (message: string) => void;
  /** The saved request id backing the currently active tab, if it lives in this collection. */
  activeRequestId: string | null;
}

const CollectionItem: React.FC<CollectionItemProps> = ({
  collection,
  expanded,
  isExpanded,
  onToggle,
  onToggleFolder,
  onRename,
  onDelete,
  onExport,
  onOpenRequest,
  onRenameRequest,
  onDeleteRequest,
  onMoveRequest,
  onNewRequest,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onMoveFolder,
  onInvalidDrop,
  activeRequestId
}) => {
  const [isRenaming, setIsRenaming] = useState(false);
  const [draftName, setDraftName] = useState(collection.name);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [draftFolderName, setDraftFolderName] = useState('');
  const [isRootDropTarget, setIsRootDropTarget] = useState(false);

  const handleRootDragOver = (e: React.DragEvent): void => {
    if (!e.dataTransfer.types.includes(DRAG_MIME_TYPE)) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    setIsRootDropTarget(true);
  };

  const handleRootDragLeave = (e: React.DragEvent): void => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsRootDropTarget(false);
  };

  const handleRootDrop = (e: React.DragEvent): void => {
    e.preventDefault();
    e.stopPropagation();
    setIsRootDropTarget(false);
    const payload = readDragPayload(e.dataTransfer);
    if (!payload) return;
    if (payload.collectionId !== collection.id) {
      onInvalidDrop('Items can only be moved within the same collection.');
      return;
    }
    if (payload.kind === 'request') onMoveRequest(payload.id, null);
    else onMoveFolder(payload.id, null);
  };

  const commitRename = (): void => {
    setIsRenaming(false);
    const trimmed = draftName.trim();
    if (trimmed && trimmed !== collection.name) onRename(trimmed);
  };

  const submitNewFolder = (): void => {
    const name = draftFolderName.trim();
    setIsCreatingFolder(false);
    setDraftFolderName('');
    if (name) onCreateFolder(null, name);
  };

  const sortedRequests = useMemo(
    () => [...collection.requests].sort((a, b) => b.updatedAt - a.updatedAt),
    [collection.requests]
  );

  const totalCount = useMemo(() => countRequestsRecursive(collection), [collection]);
  const containsActive = activeRequestId !== null;

  return (
    <div className="flex flex-col">
      <div
        onDragOver={handleRootDragOver}
        onDragLeave={handleRootDragLeave}
        onDrop={handleRootDrop}
        title="Drop here to move to collection root"
        className={`flex items-center gap-1 group px-1 py-1 rounded hover:bg-editor-bg/60 ${
          isRootDropTarget
            ? 'ring-1 ring-accent bg-accent/10'
            : containsActive
              ? 'bg-editor-bg/40'
              : ''
        }`}
      >
        <button
          onClick={onToggle}
          title={isExpanded ? 'Collapse' : 'Expand'}
          className="text-zinc-500 hover:text-white cursor-pointer shrink-0"
        >
          {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </button>

        {isRenaming ? (
          <input
            type="text"
            autoFocus
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename();
              if (e.key === 'Escape') {
                setDraftName(collection.name);
                setIsRenaming(false);
              }
            }}
            className="flex-1 bg-editor-bg border border-accent rounded px-1.5 py-0.5 text-xs text-zinc-200 focus:outline-none"
          />
        ) : (
          <span
            onDoubleClick={() => {
              setDraftName(collection.name);
              setIsRenaming(true);
            }}
            title="Double-click to rename"
            className="flex-1 truncate text-xs text-zinc-300 cursor-default"
          >
            {collection.name}
            <span className="text-zinc-600 ml-1">({totalCount})</span>
          </span>
        )}

        {!isRenaming && (
          <ActionsMenu
            triggerTitle="Collection actions"
            actions={[
              {
                icon: <Send size={12} />,
                label: 'New Request',
                onClick: () => onNewRequest(null)
              },
              {
                icon: <FolderPlus size={12} />,
                label: 'New Folder',
                onClick: () => {
                  setIsCreatingFolder(true);
                  setDraftFolderName('');
                }
              },
              {
                icon: <Pencil size={12} />,
                label: 'Rename',
                onClick: () => {
                  setDraftName(collection.name);
                  setIsRenaming(true);
                }
              },
              { icon: <Download size={12} />, label: 'Export', onClick: onExport },
              { icon: <Trash2 size={12} />, label: 'Delete', danger: true, onClick: onDelete }
            ]}
          />
        )}
      </div>

      {isExpanded && (
        <div
          onDragOver={handleRootDragOver}
          onDragLeave={handleRootDragLeave}
          onDrop={handleRootDrop}
          className={`flex flex-col gap-0.5 pl-4 rounded ${isRootDropTarget ? 'ring-1 ring-accent bg-accent/10' : ''}`}
        >
          {isCreatingFolder && (
            <input
              type="text"
              autoFocus
              placeholder="Folder name..."
              value={draftFolderName}
              onChange={(e) => setDraftFolderName(e.target.value)}
              onBlur={submitNewFolder}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitNewFolder();
                if (e.key === 'Escape') {
                  setIsCreatingFolder(false);
                  setDraftFolderName('');
                }
              }}
              className="bg-editor-bg border border-accent rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none"
            />
          )}

          {collection.folders.length === 0 && sortedRequests.length === 0 && !isCreatingFolder && (
            <div className="text-[10px] text-zinc-650 italic px-1 py-0.5">
              Empty - use Save to add a request.
            </div>
          )}

          {collection.folders.map((folder) => (
            <FolderItem
              key={folder.id}
              folder={folder}
              depth={0}
              expanded={expanded}
              onToggle={onToggleFolder}
              rootFolders={collection.folders}
              collectionId={collection.id}
              onOpenRequest={onOpenRequest}
              onRenameRequest={onRenameRequest}
              onDeleteRequest={onDeleteRequest}
              onMoveRequest={onMoveRequest}
              onNewRequest={onNewRequest}
              onCreateFolder={onCreateFolder}
              onRenameFolder={onRenameFolder}
              onDeleteFolder={onDeleteFolder}
              onMoveFolder={onMoveFolder}
              onInvalidDrop={onInvalidDrop}
              activeRequestId={activeRequestId}
            />
          ))}

          {sortedRequests.map((request) => (
            <RequestItem
              key={request.id}
              request={request}
              collectionId={collection.id}
              onOpen={() => onOpenRequest(request)}
              onRename={(name) => onRenameRequest(request.id, name)}
              onDelete={() => onDeleteRequest(request.id)}
              moveFolders={collection.folders}
              onMove={(targetFolderId) => onMoveRequest(request.id, targetFolderId)}
              isActive={request.id === activeRequestId}
            />
          ))}
        </div>
      )}
    </div>
  );
};

interface FolderItemProps {
  folder: CollectionFolder;
  depth: number;
  expanded: Set<string>;
  onToggle: (folderId: string) => void;
  rootFolders: CollectionFolder[];
  collectionId: string;
  onOpenRequest: (request: SavedRequest) => void;
  onRenameRequest: (requestId: string, name: string) => void;
  onDeleteRequest: (requestId: string) => void;
  onMoveRequest: (requestId: string, targetFolderId: string | null) => void;
  onNewRequest: (folderId: string | null) => void;
  onCreateFolder: (parentFolderId: string | null, name: string) => void;
  onRenameFolder: (folderId: string, name: string) => void;
  onDeleteFolder: (folderId: string) => void;
  onMoveFolder: (folderId: string, targetParentFolderId: string | null) => void;
  onInvalidDrop: (message: string) => void;
  /** The saved request id backing the currently active tab, if it lives in this collection. */
  activeRequestId: string | null;
}

const FolderItem: React.FC<FolderItemProps> = ({
  folder,
  depth,
  expanded,
  onToggle,
  rootFolders,
  collectionId,
  onOpenRequest,
  onRenameRequest,
  onDeleteRequest,
  onMoveRequest,
  onNewRequest,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onMoveFolder,
  onInvalidDrop,
  activeRequestId
}) => {
  const [isRenaming, setIsRenaming] = useState(false);
  const [draftName, setDraftName] = useState(folder.name);
  const [isCreatingSubfolder, setIsCreatingSubfolder] = useState(false);
  const [draftSubfolderName, setDraftSubfolderName] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isDropTarget, setIsDropTarget] = useState(false);

  const isExpanded = expanded.has(folder.id);
  const indent = depth * 12;

  const sortedRequests = useMemo(
    () => [...folder.requests].sort((a, b) => b.updatedAt - a.updatedAt),
    [folder.requests]
  );

  const containsActive =
    activeRequestId !== null && findRequestInContainer(folder, activeRequestId) !== undefined;

  const commitRename = (): void => {
    setIsRenaming(false);
    const trimmed = draftName.trim();
    if (trimmed && trimmed !== folder.name) onRenameFolder(folder.id, trimmed);
  };

  const submitSubfolder = (): void => {
    const name = draftSubfolderName.trim();
    setIsCreatingSubfolder(false);
    setDraftSubfolderName('');
    if (name) onCreateFolder(folder.id, name);
  };

  const handleDragStart = (e: React.DragEvent): void => {
    e.stopPropagation();
    e.dataTransfer.effectAllowed = 'move';
    const payload: DragPayload = { kind: 'folder', id: folder.id, collectionId };
    e.dataTransfer.setData(DRAG_MIME_TYPE, JSON.stringify(payload));
    setIsDragging(true);
  };

  const handleDragEnd = (): void => setIsDragging(false);

  const handleDragOver = (e: React.DragEvent): void => {
    if (!e.dataTransfer.types.includes(DRAG_MIME_TYPE)) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    setIsDropTarget(true);
  };

  const handleDragLeave = (e: React.DragEvent): void => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDropTarget(false);
  };

  const handleDrop = (e: React.DragEvent): void => {
    e.preventDefault();
    e.stopPropagation();
    setIsDropTarget(false);
    const payload = readDragPayload(e.dataTransfer);
    if (!payload) return;
    if (payload.collectionId !== collectionId) {
      onInvalidDrop('Items can only be moved within the same collection.');
      return;
    }
    if (payload.kind === 'request') {
      onMoveRequest(payload.id, folder.id);
      return;
    }
    if (payload.id === folder.id) return;
    const draggedFolder = findFolderById(rootFolders, payload.id);
    if (draggedFolder && isFolderOrDescendant(draggedFolder, folder.id)) {
      onInvalidDrop("Can't move a folder into itself or one of its own subfolders.");
      return;
    }
    onMoveFolder(payload.id, folder.id);
  };

  return (
    <div className="flex flex-col">
      <div
        onClick={() => onToggle(folder.id)}
        draggable
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{ paddingLeft: indent }}
        title={isExpanded ? 'Collapse folder' : 'Expand folder'}
        className={`flex items-center gap-1 group px-1 py-1 rounded hover:bg-editor-bg/60 cursor-grab active:cursor-grabbing ${
          isDragging ? 'opacity-40' : ''
        } ${isDropTarget ? 'ring-1 ring-accent bg-accent/10' : containsActive ? 'bg-editor-bg/40' : ''}`}
      >
        <span className="text-zinc-500 hover:text-white shrink-0">
          {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </span>
        {isExpanded ? (
          <FolderOpen size={12} className="text-zinc-500 shrink-0" />
        ) : (
          <Folder size={12} className="text-zinc-500 shrink-0" />
        )}

        {isRenaming ? (
          <input
            type="text"
            autoFocus
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename();
              if (e.key === 'Escape') {
                setDraftName(folder.name);
                setIsRenaming(false);
              }
            }}
            className="flex-1 bg-editor-bg border border-accent rounded px-1.5 py-0.5 text-xs text-zinc-200 focus:outline-none"
          />
        ) : (
          <span
            onDoubleClick={(e) => {
              e.stopPropagation();
              setDraftName(folder.name);
              setIsRenaming(true);
            }}
            title="Double-click to rename"
            className="flex-1 truncate text-xs text-zinc-300"
          >
            {folder.name}
            <span className="text-zinc-600 ml-1">({countRequestsRecursive(folder)})</span>
          </span>
        )}

        {!isRenaming && (
          <ActionsMenu
            triggerTitle="Folder actions"
            actions={[
              {
                icon: <Send size={12} />,
                label: 'New Request',
                onClick: () => onNewRequest(folder.id)
              },
              {
                icon: <FolderPlus size={12} />,
                label: 'New Subfolder',
                onClick: () => {
                  setIsCreatingSubfolder(true);
                  setDraftSubfolderName('');
                }
              },
              {
                icon: <Pencil size={12} />,
                label: 'Rename',
                onClick: () => {
                  setDraftName(folder.name);
                  setIsRenaming(true);
                }
              },
              {
                icon: <Trash2 size={12} />,
                label: 'Delete',
                danger: true,
                onClick: () => onDeleteFolder(folder.id)
              }
            ]}
            moveTo={{
              folders: rootFolders,
              excludeId: folder.id,
              onSelect: (targetFolderId) => onMoveFolder(folder.id, targetFolderId)
            }}
          />
        )}
      </div>

      {isCreatingSubfolder && (
        <input
          type="text"
          autoFocus
          placeholder="Folder name..."
          value={draftSubfolderName}
          onChange={(e) => setDraftSubfolderName(e.target.value)}
          onBlur={submitSubfolder}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submitSubfolder();
            if (e.key === 'Escape') {
              setIsCreatingSubfolder(false);
              setDraftSubfolderName('');
            }
          }}
          style={{ marginLeft: indent + 16 }}
          className="bg-editor-bg border border-accent rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none mt-0.5"
        />
      )}

      {isExpanded && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`flex flex-col gap-0.5 rounded ${isDropTarget ? 'ring-1 ring-accent bg-accent/10' : ''}`}
        >
          {folder.folders.length === 0 && sortedRequests.length === 0 && !isCreatingSubfolder && (
            <div
              className="text-[10px] text-zinc-650 italic px-1 py-0.5"
              style={{ paddingLeft: indent + 16 }}
            >
              Empty - use Save or drag a request here.
            </div>
          )}

          {folder.folders.map((sub) => (
            <FolderItem
              key={sub.id}
              folder={sub}
              depth={depth + 1}
              expanded={expanded}
              onToggle={onToggle}
              rootFolders={rootFolders}
              collectionId={collectionId}
              onOpenRequest={onOpenRequest}
              onRenameRequest={onRenameRequest}
              onDeleteRequest={onDeleteRequest}
              onMoveRequest={onMoveRequest}
              onNewRequest={onNewRequest}
              onCreateFolder={onCreateFolder}
              onRenameFolder={onRenameFolder}
              onDeleteFolder={onDeleteFolder}
              onMoveFolder={onMoveFolder}
              onInvalidDrop={onInvalidDrop}
              activeRequestId={activeRequestId}
            />
          ))}

          {sortedRequests.map((request) => (
            <RequestItem
              key={request.id}
              request={request}
              indent={depth + 1}
              collectionId={collectionId}
              onOpen={() => onOpenRequest(request)}
              onRename={(name) => onRenameRequest(request.id, name)}
              onDelete={() => onDeleteRequest(request.id)}
              moveFolders={rootFolders}
              onMove={(targetFolderId) => onMoveRequest(request.id, targetFolderId)}
              isActive={request.id === activeRequestId}
            />
          ))}
        </div>
      )}
    </div>
  );
};

interface RequestItemProps {
  request: SavedRequest;
  indent?: number;
  collectionId: string;
  onOpen: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
  /** The collection's whole folder tree — used to build the "Move to..." target list. */
  moveFolders: CollectionFolder[];
  onMove: (targetFolderId: string | null) => void;
  /** Whether this request backs the currently active tab — highlighted so the user can see where they are. */
  isActive: boolean;
}

const RequestItem: React.FC<RequestItemProps> = ({
  request,
  indent = 0,
  collectionId,
  onOpen,
  onRename,
  onDelete,
  moveFolders,
  onMove,
  isActive
}) => {
  const [isRenaming, setIsRenaming] = useState(false);
  const [draftName, setDraftName] = useState(request.name);
  const [isDragging, setIsDragging] = useState(false);
  const style = { marginLeft: indent * 12 };

  const handleDragStart = (e: React.DragEvent): void => {
    e.stopPropagation();
    e.dataTransfer.effectAllowed = 'move';
    const payload: DragPayload = { kind: 'request', id: request.id, collectionId };
    e.dataTransfer.setData(DRAG_MIME_TYPE, JSON.stringify(payload));
    setIsDragging(true);
  };

  const handleDragEnd = (): void => setIsDragging(false);

  const commitRename = (): void => {
    setIsRenaming(false);
    const trimmed = draftName.trim();
    if (trimmed && trimmed !== request.name) onRename(trimmed);
  };

  if (isRenaming) {
    return (
      <div
        style={style}
        className="flex items-center gap-2 p-1.5 rounded border border-accent bg-editor-bg"
      >
        <RequestMethodBadge request={request} />
        <input
          type="text"
          autoFocus
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitRename();
            if (e.key === 'Escape') {
              setDraftName(request.name);
              setIsRenaming(false);
            }
          }}
          className="flex-1 bg-transparent text-xs text-zinc-200 focus:outline-none min-w-0"
        />
      </div>
    );
  }

  return (
    <div
      onClick={onOpen}
      onDoubleClick={(e) => {
        e.stopPropagation();
        setDraftName(request.name);
        setIsRenaming(true);
      }}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      title={request.url}
      style={style}
      className={`flex items-center gap-2 p-1.5 hover:bg-editor-bg rounded text-xs cursor-grab active:cursor-grabbing border transition-all group ${
        isDragging ? 'opacity-40' : ''
      } ${
        isActive
          ? 'bg-accent/10 border-accent/60'
          : 'bg-editor-bg/40 border-transparent hover:border-border-dark'
      }`}
    >
      {isActive && <span className="w-1 h-1 rounded-full bg-accent shrink-0" />}
      <RequestMethodBadge request={request} />
      <span
        className={`truncate flex-1 ${isActive ? 'text-white' : 'text-zinc-300 group-hover:text-white'}`}
      >
        {request.name}
      </span>
      <ActionsMenu
        triggerTitle="Request actions"
        actions={[
          {
            icon: <Pencil size={12} />,
            label: 'Rename',
            onClick: () => {
              setDraftName(request.name);
              setIsRenaming(true);
            }
          },
          { icon: <Trash2 size={12} />, label: 'Delete', danger: true, onClick: onDelete }
        ]}
        moveTo={{ folders: moveFolders, onSelect: onMove }}
      />
    </div>
  );
};
