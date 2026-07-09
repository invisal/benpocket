import React, { useEffect, useMemo, useState } from 'react';
import { Popover } from '@base-ui/react/popover';
import {
  ChevronDown,
  ChevronRight,
  Download,
  Folder,
  FolderOpen,
  FolderPlus,
  Move,
  Pencil,
  Plus,
  Send,
  Trash2,
  Upload,
  X
} from 'lucide-react';
import { usePostmanTabsStore } from './store/tabs.store';
import { useCollectionsStore } from './store/collections.store';
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

function methodBadgeClass(method: string): string {
  switch (method) {
    case 'GET':
      return 'bg-emerald-950/40 text-emerald-500';
    case 'POST':
      return 'bg-amber-950/40 text-amber-500';
    case 'PUT':
      return 'bg-sky-950/40 text-sky-500';
    case 'PATCH':
      return 'bg-purple-950/40 text-purple-400';
    case 'DELETE':
      return 'bg-red-950/40 text-red-500';
    default:
      return 'bg-zinc-800 text-zinc-400';
  }
}

export const HttpClientSidebar: React.FC = () => {
  const { openTab, openNewRequestTab } = usePostmanTabsStore();
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

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [isCreatingCollection, setIsCreatingCollection] = useState(false);
  const [draftCollectionName, setDraftCollectionName] = useState('');
  const [statusMessage, setStatusMessage] = useState<{
    type: 'error' | 'success';
    text: string;
  } | null>(null);

  // Newly loaded collections default to expanded (folders inside default to
  // collapsed). Adjusted directly during render (rather than in an effect) so
  // it applies before paint and doesn't trigger an extra render pass; guarded
  // by `knownCollectionIds` so it only reacts to genuinely new collections,
  // not to the user manually collapsing one.
  const [knownCollectionIds, setKnownCollectionIds] = useState<Set<string>>(new Set());
  const unseenCollectionIds = collections
    .map((c) => c.id)
    .filter((id) => !knownCollectionIds.has(id));
  if (unseenCollectionIds.length > 0) {
    setKnownCollectionIds((prev) => {
      const next = new Set(prev);
      for (const id of unseenCollectionIds) next.add(id);
      return next;
    });
    setExpanded((prev) => {
      const next = new Set(prev);
      for (const id of unseenCollectionIds) next.add(id);
      return next;
    });
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
    const seed: PostmanTabSeed = {
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

  const submitNewCollection = (): void => {
    const name = draftCollectionName.trim();
    setIsCreatingCollection(false);
    setDraftCollectionName('');
    if (name) createCollection(name);
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
        <h3 className="text-[10px] font-bold tracking-wider text-zinc-500 uppercase">
          HTTP Client
        </h3>
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
          <div className="text-[11px] text-zinc-650 italic px-1 py-1">
            No collections yet. Save a request, or import a Postman collection (v2.0 / v2.1 .json).
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
              onRename={(name) => renameCollection(collection.id, name)}
              onDelete={() => deleteCollection(collection.id)}
              onExport={() => handleExportCollection(collection.id)}
              onOpenRequest={(request) => openSavedRequest(collection, request)}
              onRenameRequest={(requestId, name) => renameRequest(collection.id, requestId, name)}
              onDeleteRequest={(requestId) => deleteRequest(collection.id, requestId)}
              onMoveRequest={(requestId, targetFolderId) =>
                moveRequest(collection.id, requestId, targetFolderId)
              }
              onNewRequest={(folderId) => openNewRequestInFolder(collection.id, folderId)}
              onCreateFolder={(parentFolderId, name) =>
                createFolder(collection.id, parentFolderId, name)
              }
              onRenameFolder={(folderId, name) => renameFolder(collection.id, folderId, name)}
              onDeleteFolder={(folderId) => deleteFolder(collection.id, folderId)}
              onMoveFolder={(folderId, targetParentFolderId) =>
                moveFolder(collection.id, folderId, targetParentFolderId)
              }
              onInvalidDrop={handleInvalidDrop}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

interface MoveToFolderPopoverProps {
  /** The whole collection's root folder tree — options are computed across all of it, not just siblings. */
  folders: CollectionFolder[];
  /** Exclude this folder (and its descendants) from the target list — used when moving a folder itself. */
  excludeId?: string;
  title: string;
  onSelect: (targetFolderId: string | null) => void;
}

const MoveToFolderPopover: React.FC<MoveToFolderPopoverProps> = ({
  folders,
  excludeId,
  title,
  onSelect
}) => {
  const [open, setOpen] = useState(false);
  const options = useMemo(() => flattenFolderOptions(folders, 0, excludeId), [folders, excludeId]);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        onClick={(e) => e.stopPropagation()}
        title={title}
        className="p-0.5 text-zinc-555 hover:text-white cursor-pointer"
      >
        <Move size={11} />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={6} align="start" className="z-50">
          <Popover.Popup
            onClick={(e) => e.stopPropagation()}
            className="bg-sidebar-bg border border-border-dark rounded-lg shadow-xl p-1 w-56 max-h-64 overflow-y-auto flex flex-col gap-0.5 text-xs outline-none"
          >
            <button
              onClick={() => {
                onSelect(null);
                setOpen(false);
              }}
              className="text-left px-2 py-1 rounded hover:bg-editor-bg text-zinc-300 hover:text-white cursor-pointer"
            >
              Collection Root
            </button>
            {options.map((opt) => (
              <button
                key={opt.id}
                onClick={() => {
                  onSelect(opt.id);
                  setOpen(false);
                }}
                style={{ paddingLeft: 8 + opt.depth * 12 }}
                className="text-left px-2 py-1 rounded hover:bg-editor-bg text-zinc-300 hover:text-white cursor-pointer truncate"
              >
                {opt.name}
              </button>
            ))}
            {options.length === 0 && (
              <div className="px-2 py-1 text-zinc-600 italic">No other folders</div>
            )}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
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
  onInvalidDrop
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

  return (
    <div className="flex flex-col">
      <div
        onDragOver={handleRootDragOver}
        onDragLeave={handleRootDragLeave}
        onDrop={handleRootDrop}
        title="Drop here to move to collection root"
        className={`flex items-center gap-1 group px-1 py-1 rounded hover:bg-editor-bg/60 ${
          isRootDropTarget ? 'ring-1 ring-accent bg-accent/10' : ''
        }`}
      >
        <button
          onClick={onToggle}
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
          <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
            <button
              onClick={() => onNewRequest(null)}
              title="New request in this collection"
              className="p-0.5 text-zinc-555 hover:text-white cursor-pointer"
            >
              <Send size={11} />
            </button>
            <button
              onClick={() => {
                setIsCreatingFolder(true);
                setDraftFolderName('');
              }}
              title="New folder"
              className="p-0.5 text-zinc-555 hover:text-white cursor-pointer"
            >
              <FolderPlus size={11} />
            </button>
            <button
              onClick={() => {
                setDraftName(collection.name);
                setIsRenaming(true);
              }}
              title="Rename collection"
              className="p-0.5 text-zinc-555 hover:text-white cursor-pointer"
            >
              <Pencil size={11} />
            </button>
            <button
              onClick={onExport}
              title="Export collection (.json)"
              className="p-0.5 text-zinc-555 hover:text-white cursor-pointer"
            >
              <Download size={11} />
            </button>
            <button
              onClick={onDelete}
              title="Delete collection"
              className="p-0.5 text-zinc-555 hover:text-red-400 cursor-pointer"
            >
              <Trash2 size={11} />
            </button>
          </div>
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
              moveAction={
                collection.folders.length > 0 ? (
                  <MoveToFolderPopover
                    folders={collection.folders}
                    title="Move request to folder"
                    onSelect={(targetFolderId) => onMoveRequest(request.id, targetFolderId)}
                  />
                ) : undefined
              }
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
  onInvalidDrop
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
        className={`flex items-center gap-1 group px-1 py-1 rounded hover:bg-editor-bg/60 cursor-grab active:cursor-grabbing ${
          isDragging ? 'opacity-40' : ''
        } ${isDropTarget ? 'ring-1 ring-accent bg-accent/10' : ''}`}
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
          <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onNewRequest(folder.id);
              }}
              title="New request in this folder"
              className="p-0.5 text-zinc-555 hover:text-white cursor-pointer"
            >
              <Send size={11} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsCreatingSubfolder(true);
                setDraftSubfolderName('');
              }}
              title="New subfolder"
              className="p-0.5 text-zinc-555 hover:text-white cursor-pointer"
            >
              <FolderPlus size={11} />
            </button>
            <MoveToFolderPopover
              folders={rootFolders}
              excludeId={folder.id}
              title="Move folder"
              onSelect={(targetFolderId) => onMoveFolder(folder.id, targetFolderId)}
            />
            <button
              onClick={(e) => {
                e.stopPropagation();
                setDraftName(folder.name);
                setIsRenaming(true);
              }}
              title="Rename folder"
              className="p-0.5 text-zinc-555 hover:text-white cursor-pointer"
            >
              <Pencil size={11} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDeleteFolder(folder.id);
              }}
              title="Delete folder"
              className="p-0.5 text-zinc-555 hover:text-red-400 cursor-pointer"
            >
              <Trash2 size={11} />
            </button>
          </div>
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
              Empty folder.
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
              moveAction={
                <MoveToFolderPopover
                  folders={rootFolders}
                  title="Move request to folder"
                  onSelect={(targetFolderId) => onMoveRequest(request.id, targetFolderId)}
                />
              }
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
  moveAction?: React.ReactNode;
}

const RequestItem: React.FC<RequestItemProps> = ({
  request,
  indent = 0,
  collectionId,
  onOpen,
  onRename,
  onDelete,
  moveAction
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
        <span
          className={`text-[9px] font-extrabold px-1 py-0.5 rounded shrink-0 ${methodBadgeClass(request.method)}`}
        >
          {request.method}
        </span>
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
      className={`flex items-center gap-2 p-1.5 bg-editor-bg/40 hover:bg-editor-bg rounded text-xs cursor-grab active:cursor-grabbing border border-transparent hover:border-border-dark transition-all group ${
        isDragging ? 'opacity-40' : ''
      }`}
    >
      <span
        className={`text-[9px] font-extrabold px-1 py-0.5 rounded shrink-0 ${methodBadgeClass(request.method)}`}
      >
        {request.method}
      </span>
      <span className="truncate text-zinc-300 group-hover:text-white flex-1">{request.name}</span>
      <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
        {moveAction}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          title="Delete request"
          className="p-0.5 text-zinc-555 hover:text-red-400 cursor-pointer"
        >
          <Trash2 size={11} />
        </button>
      </div>
    </div>
  );
};
