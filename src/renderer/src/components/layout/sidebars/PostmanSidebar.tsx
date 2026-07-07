import React, { useEffect, useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Download,
  FolderPlus,
  Pencil,
  Plus,
  Send,
  Trash2,
  Upload,
  X
} from 'lucide-react';
import { useLayoutStore } from '../../../store/layout.store';
import { useCollectionsStore } from '../../../store/collections.store';
import type { Collection, SavedRequest } from '../../../../../preload/postman.types';
import type { PostmanTabSeed } from '../../../hooks/useApiClient';

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

export const PostmanSidebar: React.FC = () => {
  const { openTab, activeInstanceId } = useLayoutStore();
  const {
    collections,
    isLoaded,
    load,
    createCollection,
    renameCollection,
    deleteCollection,
    renameRequest,
    deleteRequest,
    exportCollection,
    importCollection
  } = useCollectionsStore();

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [isCreatingCollection, setIsCreatingCollection] = useState(false);
  const [draftCollectionName, setDraftCollectionName] = useState('');
  const [statusMessage, setStatusMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  useEffect(() => {
    if (!isLoaded) load();
  }, [isLoaded, load]);

  useEffect(() => {
    if (!statusMessage) return;
    const timer = setTimeout(() => setStatusMessage(null), 5000);
    return () => clearTimeout(timer);
  }, [statusMessage]);

  useEffect(() => {
    // Newly loaded collections default to expanded.
    setExpanded((prev) => {
      const next = new Set(prev);
      for (const c of collections) next.add(c.id);
      return next;
    });
  }, [collections]);

  const handleNewPostmanRequest = (): void => {
    const requestId = `postman-req-${Date.now()}`;
    openTab({
      id: requestId,
      title: 'New API Request',
      type: 'postman',
      instanceId: activeInstanceId,
      meta: { method: 'GET', url: '' } satisfies PostmanTabSeed
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
      type: 'postman',
      instanceId: activeInstanceId,
      meta: seed
    });
  };

  const submitNewCollection = (): void => {
    const name = draftCollectionName.trim();
    setIsCreatingCollection(false);
    setDraftCollectionName('');
    if (name) createCollection(name);
  };

  const toggleExpanded = (collectionId: string): void => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(collectionId)) next.delete(collectionId);
      else next.add(collectionId);
      return next;
    });
  };

  const handleImportCollection = async (): Promise<void> => {
    const result = await importCollection();
    if (result.canceled) return;
    if (!result.ok) {
      setStatusMessage({ type: 'error', text: result.error ?? 'Import failed.' });
    } else if (result.collection) {
      setExpanded((prev) => new Set(prev).add(result.collection!.id));
      setStatusMessage({
        type: 'success',
        text: `Imported "${result.collection.name}" (${result.collection.requests.length} requests).`
      });
    }
  };

  const handleExportCollection = async (collectionId: string): Promise<void> => {
    const result = await exportCollection(collectionId);
    if (result.canceled) return;
    setStatusMessage(
      result.ok ? { type: 'success', text: 'Collection exported.' } : { type: 'error', text: result.error ?? 'Export failed.' }
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[10px] font-bold tracking-wider text-zinc-500 uppercase">Postman Client</h3>
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
              title="Import Postman Collection (.json)"
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
            <button onClick={() => setStatusMessage(null)} className="shrink-0 cursor-pointer hover:opacity-70">
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
            No collections yet. Save a request to create one.
          </div>
        )}

        <div className="flex flex-col gap-0.5">
          {collections.map((collection) => (
            <CollectionItem
              key={collection.id}
              collection={collection}
              isExpanded={expanded.has(collection.id)}
              onToggle={() => toggleExpanded(collection.id)}
              onRename={(name) => renameCollection(collection.id, name)}
              onDelete={() => deleteCollection(collection.id)}
              onExport={() => handleExportCollection(collection.id)}
              onOpenRequest={(request) => openSavedRequest(collection, request)}
              onRenameRequest={(requestId, name) => renameRequest(collection.id, requestId, name)}
              onDeleteRequest={(requestId) => deleteRequest(collection.id, requestId)}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

interface CollectionItemProps {
  collection: Collection;
  isExpanded: boolean;
  onToggle: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
  onExport: () => void;
  onOpenRequest: (request: SavedRequest) => void;
  onRenameRequest: (requestId: string, name: string) => void;
  onDeleteRequest: (requestId: string) => void;
}

const CollectionItem: React.FC<CollectionItemProps> = ({
  collection,
  isExpanded,
  onToggle,
  onRename,
  onDelete,
  onExport,
  onOpenRequest,
  onRenameRequest,
  onDeleteRequest
}) => {
  const [isRenaming, setIsRenaming] = useState(false);
  const [draftName, setDraftName] = useState(collection.name);

  const commitRename = (): void => {
    setIsRenaming(false);
    const trimmed = draftName.trim();
    if (trimmed && trimmed !== collection.name) onRename(trimmed);
  };

  const sortedRequests = useMemo(
    () => [...collection.requests].sort((a, b) => b.updatedAt - a.updatedAt),
    [collection.requests]
  );

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-1 group px-1 py-1 rounded hover:bg-editor-bg/60">
        <button onClick={onToggle} className="text-zinc-500 hover:text-white cursor-pointer shrink-0">
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
            <span className="text-zinc-600 ml-1">({collection.requests.length})</span>
          </span>
        )}

        {!isRenaming && (
          <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
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
            <button onClick={onExport} title="Export collection (.json)" className="p-0.5 text-zinc-555 hover:text-white cursor-pointer">
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
        <div className="flex flex-col gap-0.5 pl-4">
          {sortedRequests.length === 0 && (
            <div className="text-[10px] text-zinc-650 italic px-1 py-0.5">Empty - use Save to add a request.</div>
          )}
          {sortedRequests.map((request) => (
            <RequestItem
              key={request.id}
              request={request}
              onOpen={() => onOpenRequest(request)}
              onRename={(name) => onRenameRequest(request.id, name)}
              onDelete={() => onDeleteRequest(request.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

interface RequestItemProps {
  request: SavedRequest;
  onOpen: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
}

const RequestItem: React.FC<RequestItemProps> = ({ request, onOpen, onRename, onDelete }) => {
  const [isRenaming, setIsRenaming] = useState(false);
  const [draftName, setDraftName] = useState(request.name);

  const commitRename = (): void => {
    setIsRenaming(false);
    const trimmed = draftName.trim();
    if (trimmed && trimmed !== request.name) onRename(trimmed);
  };

  if (isRenaming) {
    return (
      <div className="flex items-center gap-2 p-1.5 rounded border border-accent bg-editor-bg">
        <span className={`text-[9px] font-extrabold px-1 py-0.5 rounded shrink-0 ${methodBadgeClass(request.method)}`}>
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
      title={request.url}
      className="flex items-center gap-2 p-1.5 bg-editor-bg/40 hover:bg-editor-bg rounded text-xs cursor-pointer border border-transparent hover:border-border-dark transition-all group"
    >
      <span className={`text-[9px] font-extrabold px-1 py-0.5 rounded shrink-0 ${methodBadgeClass(request.method)}`}>
        {request.method}
      </span>
      <span className="truncate text-zinc-300 group-hover:text-white flex-1">{request.name}</span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        title="Delete request"
        className="hidden group-hover:block p-0.5 text-zinc-555 hover:text-red-400 cursor-pointer shrink-0"
      >
        <Trash2 size={11} />
      </button>
    </div>
  );
};
