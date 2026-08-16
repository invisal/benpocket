import type React from 'react';
import { useMemo, useState } from 'react';
import { Popover } from '@base-ui/react/popover';
import { cn } from 'cnfast';
import {
  Bookmark,
  ChevronLeft,
  Download,
  Folder,
  FolderOpen,
  FolderPlus,
  KeyRound,
  Move,
  MoreHorizontal,
  Pencil,
  Send,
  Trash2,
  Waves
} from 'lucide-react';
import { TreeList, type TreeItemMeta } from '@renderer/components/ui/TreeList';
import type {
  Collection,
  CollectionFolder,
  HttpAuth,
  SavedExample,
  SavedRequest
} from '../../../../preload/http-client/types';
import { AuthorizationDialog } from './AuthorizationDialog';
import { methodBadgeClass } from '../lib/methodBadge';
import {
  countRequestsRecursive,
  findRequestInContainer,
  flattenFolderOptions,
  isFolderOrDescendant
} from '../lib/collectionTree';

function exampleStatusClass(status: number): string {
  if (status === 0) return 'text-red-500';
  if (status < 300) return 'text-emerald-500';
  if (status < 400) return 'text-sky-500';
  if (status < 500) return 'text-amber-500';
  return 'text-red-500';
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
      className={`text-[9px] font-medium px-1 py-0.5 rounded shrink-0 ${methodBadgeClass(request.method)}`}
    >
      {request.method}
    </span>
  );
};

// A collection/folder/request/example tree, unified into one discriminated union so a single
// TreeList can recurse over it. `rootFolders` is threaded down onto every folder/request node
// (always the owning collection's top-level `folders` array, not just the immediate parent's) --
// it's what the "Move to..." submenu needs to offer every folder in the collection, not just
// siblings.
type CollectionTreeNode =
  | { kind: 'collection'; collection: Collection }
  | {
      kind: 'folder';
      folder: CollectionFolder;
      collectionId: string;
      rootFolders: CollectionFolder[];
    }
  | {
      kind: 'request';
      request: SavedRequest;
      collectionId: string;
      rootFolders: CollectionFolder[];
    }
  | { kind: 'example'; example: SavedExample; requestId: string; collectionId: string };

function nodeId(node: CollectionTreeNode): string {
  switch (node.kind) {
    case 'collection':
      return node.collection.id;
    case 'folder':
      return node.folder.id;
    case 'request':
      return node.request.id;
    case 'example':
      return node.example.id;
  }
}

function nodeCollectionId(node: CollectionTreeNode): string {
  return node.kind === 'collection' ? node.collection.id : node.collectionId;
}

function sortByUpdatedDesc(requests: SavedRequest[]): SavedRequest[] {
  return [...requests].sort((a, b) => b.updatedAt - a.updatedAt);
}

/**
 * Whether the active request or example lives anywhere inside this container's subtree.
 * A collection/folder can never be "selected" itself -- only a request/example ever backs
 * the active tab -- so this is the only thing a container's highlight can ever mean.
 */
function subtreeHasActiveDescendant(
  container: { requests: SavedRequest[]; folders: CollectionFolder[] },
  activeRequestId: string | null,
  activeExampleId: string | null
): boolean {
  if (!activeRequestId && !activeExampleId) return false;
  for (const request of container.requests) {
    if (request.id === activeRequestId) return true;
    if (activeExampleId && (request.examples ?? []).some((e) => e.id === activeExampleId))
      return true;
  }
  return container.folders.some((f) =>
    subtreeHasActiveDescendant(f, activeRequestId, activeExampleId)
  );
}

function nodeChildren(node: CollectionTreeNode): CollectionTreeNode[] | undefined {
  switch (node.kind) {
    case 'collection': {
      const rootFolders = node.collection.folders;
      return [
        ...rootFolders.map(
          (folder) =>
            ({ kind: 'folder', folder, collectionId: node.collection.id, rootFolders }) as const
        ),
        ...sortByUpdatedDesc(node.collection.requests).map(
          (request) =>
            ({ kind: 'request', request, collectionId: node.collection.id, rootFolders }) as const
        )
      ];
    }
    case 'folder':
      return [
        ...node.folder.folders.map(
          (folder) =>
            ({
              kind: 'folder',
              folder,
              collectionId: node.collectionId,
              rootFolders: node.rootFolders
            }) as const
        ),
        ...sortByUpdatedDesc(node.folder.requests).map(
          (request) =>
            ({
              kind: 'request',
              request,
              collectionId: node.collectionId,
              rootFolders: node.rootFolders
            }) as const
        )
      ];
    case 'request': {
      const examples = node.request.examples ?? [];
      if (examples.length === 0) return undefined;
      return examples.map(
        (example) =>
          ({
            kind: 'example',
            example,
            requestId: node.request.id,
            collectionId: node.collectionId
          }) as const
      );
    }
    case 'example':
      return undefined;
  }
}

interface MenuButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}

const MenuButton: React.FC<MenuButtonProps> = ({ icon, label, onClick, danger }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-2 text-left px-2 py-1.5 rounded hover:bg-border-dark/60 cursor-pointer ${
      danger ? 'text-red-400 hover:text-red-300' : 'text-zinc-300 hover:text-foreground'
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
  /** Rendered in the trigger's place at rest (e.g. a method badge); swaps to the "..." trigger on hover, in the same slot so nothing reflows. */
  idleContent?: React.ReactNode;
}

/**
 * A single "..." trigger that pops open a stacked menu of actions for a collection, folder or
 * request item, instead of a row of always-competing hover icons.
 *
 * Owns the reveal-on-hover wrapper itself (rather than leaving it to the caller) because it must
 * force itself visible while the popover is open: the popup renders in a portal outside the
 * hovered row, so moving the mouse into the popup drops the row's `:hover`. Hidden via opacity
 * rather than `display` for two reasons: a `display:none` trigger's bounding rect collapses to
 * (0,0), which would make the floating-positioned popup jump to the top-left corner mid-
 * interaction; and toggling `display` reflows the row's truncated label width on every hover,
 * reading as a layout shift. Opacity keeps the trigger's space reserved at rest instead.
 *
 * When `idleContent` is given, it occupies the same slot as the trigger (stacked via `absolute
 * inset-0` on the trigger) and swaps instantly with it on hover/open, rather than sitting beside
 * it. Deliberately not animated: a fade leaves both visible mid-transition since they toggle via
 * opposite Tailwind states (`group-hover:opacity-0` vs. `group-hover:opacity-100`) with no shared
 * timeline to keep them in sync, so they'd briefly overlap.
 */
const ActionsMenu: React.FC<ActionsMenuProps> = ({
  actions,
  moveTo,
  triggerTitle = 'More actions',
  triggerClassName = 'p-0.5 text-zinc-555 hover:text-foreground cursor-pointer',
  idleContent
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
      className={cn('shrink-0', idleContent && 'relative')}
      onClick={(e) => e.stopPropagation()}
      draggable={false}
    >
      {idleContent && (
        <div className={cn('flex items-center', open ? 'opacity-0' : 'group-hover:opacity-0')}>
          {idleContent}
        </div>
      )}
      <Popover.Root
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setView('menu');
        }}
      >
        <Popover.Trigger
          title={triggerTitle}
          className={cn(
            triggerClassName,
            open ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
            idleContent && 'absolute inset-0 flex items-center justify-end'
          )}
        >
          <MoreHorizontal size={13} />
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner sideOffset={4} align="start" className="z-50">
            <Popover.Popup
              onClick={(e) => e.stopPropagation()}
              className="bg-surface border border-border-dark rounded-lg shadow-xl p-1 w-48 max-h-72 overflow-y-auto flex flex-col gap-0.5 text-xs outline-none"
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
                    className="flex items-center gap-1 text-left px-2 py-1.5 rounded hover:bg-border-dark/60 text-zinc-400 hover:text-foreground cursor-pointer"
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
                    className="text-left px-2 py-1.5 rounded hover:bg-border-dark/60 text-zinc-300 hover:text-foreground cursor-pointer"
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
                      className="text-left px-2 py-1.5 rounded hover:bg-border-dark/60 text-zinc-300 hover:text-foreground cursor-pointer truncate"
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

export interface CollectionsTreeProps {
  collections: Collection[];
  expanded: Set<string>;
  onExpandedChange: (next: Set<string>) => void;
  /** The saved collection id backing the currently active tab, if any. */
  activeCollectionId: string | null;
  /** The saved request id backing the currently active tab, if any. */
  activeRequestId: string | null;
  /** The saved example id backing the currently active tab, if any. */
  activeExampleId: string | null;
  onOpenRequest: (
    collection: Collection,
    request: SavedRequest,
    options?: { preview?: boolean }
  ) => void;
  onOpenExample: (
    collection: Collection,
    request: SavedRequest,
    example: SavedExample,
    options?: { preview?: boolean }
  ) => void;
  onNewRequest: (collectionId: string, folderId: string | null) => void;
  onRenameCollection: (collectionId: string, name: string) => void;
  onDeleteCollection: (collectionId: string) => void;
  onExportCollection: (collectionId: string) => void;
  onSetCollectionAuth: (collectionId: string, auth: HttpAuth) => Promise<void>;
  onCreateFolder: (collectionId: string, parentFolderId: string | null, name: string) => void;
  onRenameFolder: (collectionId: string, folderId: string, name: string) => void;
  onDeleteFolder: (collectionId: string, folderId: string) => void;
  onMoveFolder: (
    collectionId: string,
    folderId: string,
    targetParentFolderId: string | null
  ) => void;
  onSetFolderAuth: (collectionId: string, folderId: string, auth: HttpAuth) => Promise<void>;
  onRenameRequest: (collectionId: string, requestId: string, name: string) => void;
  onDeleteRequest: (collectionId: string, requestId: string) => void;
  onMoveRequest: (collectionId: string, requestId: string, targetFolderId: string | null) => void;
  onRenameExample: (
    collectionId: string,
    requestId: string,
    exampleId: string,
    name: string
  ) => void;
  onDeleteExample: (collectionId: string, requestId: string, exampleId: string) => void;
  onInvalidDrop: (message: string) => void;
}

export const CollectionsTree: React.FC<CollectionsTreeProps> = (props) => {
  const {
    collections,
    expanded,
    onExpandedChange,
    activeCollectionId,
    activeRequestId,
    activeExampleId,
    onOpenRequest,
    onOpenExample,
    onNewRequest,
    onRenameCollection,
    onDeleteCollection,
    onExportCollection,
    onSetCollectionAuth,
    onCreateFolder,
    onRenameFolder,
    onDeleteFolder,
    onMoveFolder,
    onSetFolderAuth,
    onRenameRequest,
    onDeleteRequest,
    onMoveRequest,
    onRenameExample,
    onDeleteExample,
    onInvalidDrop
  } = props;

  const data = useMemo<CollectionTreeNode[]>(
    () => collections.map((collection) => ({ kind: 'collection', collection })),
    [collections]
  );

  const toggle = (id: string): void => {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onExpandedChange(next);
  };

  return (
    <TreeList<CollectionTreeNode>
      data={data}
      getId={nodeId}
      getChildren={nodeChildren}
      expanded={expanded}
      onExpandedChange={onExpandedChange}
      indent={20}
      draggable
      onDropOnNode={(dragged, target) => {
        // Only folder/request rows ever spread drag-source handlers, so `dragged`
        // is always one of those two kinds in practice.
        if (dragged.kind !== 'folder' && dragged.kind !== 'request') return;
        if (target.kind !== 'collection' && target.kind !== 'folder') return;
        if (nodeCollectionId(dragged) !== nodeCollectionId(target)) {
          onInvalidDrop('Items can only be moved within the same collection.');
          return;
        }
        const targetFolderId = target.kind === 'folder' ? target.folder.id : null;
        const collectionId = nodeCollectionId(target);
        if (dragged.kind === 'request') {
          onMoveRequest(collectionId, dragged.request.id, targetFolderId);
          return;
        }
        if (target.kind === 'folder') {
          if (dragged.folder.id === target.folder.id) return;
          if (isFolderOrDescendant(dragged.folder, target.folder.id)) {
            onInvalidDrop("Can't move a folder into itself or one of its own subfolders.");
            return;
          }
        }
        onMoveFolder(collectionId, dragged.folder.id, targetFolderId);
      }}
      onActivate={(node) => {
        switch (node.kind) {
          case 'request': {
            const collection = collections.find((c) => c.id === node.collectionId);
            if (collection) onOpenRequest(collection, node.request, { preview: false });
            break;
          }
          case 'example': {
            const collection = collections.find((c) => c.id === node.collectionId);
            const request = collection && findRequestInContainer(collection, node.requestId);
            if (collection && request)
              onOpenExample(collection, request, node.example, { preview: false });
            break;
          }
          case 'collection':
            toggle(node.collection.id);
            break;
          case 'folder':
            toggle(node.folder.id);
            break;
        }
      }}
      renderItem={(node, meta) => {
        switch (node.kind) {
          case 'collection':
            return (
              <CollectionRow
                collection={node.collection}
                meta={meta}
                containsActive={
                  node.collection.id === activeCollectionId &&
                  subtreeHasActiveDescendant(node.collection, activeRequestId, activeExampleId)
                }
                onRename={(name) => onRenameCollection(node.collection.id, name)}
                onDelete={() => onDeleteCollection(node.collection.id)}
                onExport={() => onExportCollection(node.collection.id)}
                onSetAuth={(auth) => onSetCollectionAuth(node.collection.id, auth)}
                onNewRequest={() => onNewRequest(node.collection.id, null)}
                onCreateFolder={(name) => onCreateFolder(node.collection.id, null, name)}
              />
            );
          case 'folder':
            return (
              <FolderRow
                folder={node.folder}
                collectionId={node.collectionId}
                meta={meta}
                containsActive={
                  node.collectionId === activeCollectionId &&
                  subtreeHasActiveDescendant(node.folder, activeRequestId, activeExampleId)
                }
                onRename={(name) => onRenameFolder(node.collectionId, node.folder.id, name)}
                onDelete={() => onDeleteFolder(node.collectionId, node.folder.id)}
                onSetAuth={(auth) => onSetFolderAuth(node.collectionId, node.folder.id, auth)}
                onNewRequest={() => onNewRequest(node.collectionId, node.folder.id)}
                onCreateFolder={(name) => onCreateFolder(node.collectionId, node.folder.id, name)}
                moveFolders={node.rootFolders}
                onMove={(targetFolderId) =>
                  onMoveFolder(node.collectionId, node.folder.id, targetFolderId)
                }
              />
            );
          case 'request': {
            const collection = collections.find((c) => c.id === node.collectionId);
            return (
              <RequestRow
                request={node.request}
                meta={meta}
                isActive={
                  node.collectionId === activeCollectionId && node.request.id === activeRequestId
                }
                onOpen={(options) => {
                  if (collection) onOpenRequest(collection, node.request, options);
                }}
                onRename={(name) => onRenameRequest(node.collectionId, node.request.id, name)}
                onDelete={() => onDeleteRequest(node.collectionId, node.request.id)}
                moveFolders={node.rootFolders}
                onMove={(targetFolderId) =>
                  onMoveRequest(node.collectionId, node.request.id, targetFolderId)
                }
              />
            );
          }
          case 'example': {
            const collection = collections.find((c) => c.id === node.collectionId);
            const request = collection && findRequestInContainer(collection, node.requestId);
            return (
              <ExampleRow
                example={node.example}
                meta={meta}
                isActive={node.example.id === activeExampleId}
                onOpen={(options) => {
                  if (collection && request)
                    onOpenExample(collection, request, node.example, options);
                }}
                onRename={(name) =>
                  onRenameExample(node.collectionId, node.requestId, node.example.id, name)
                }
                onDelete={() => onDeleteExample(node.collectionId, node.requestId, node.example.id)}
              />
            );
          }
        }
      }}
    />
  );
};

interface CollectionRowProps {
  collection: Collection;
  meta: TreeItemMeta<CollectionTreeNode>;
  /** Whether the active request/example lives somewhere inside this collection -- never "this collection itself is selected", since a collection is never what backs an open tab. */
  containsActive: boolean;
  onRename: (name: string) => void;
  onDelete: () => void;
  onExport: () => void;
  onSetAuth: (auth: HttpAuth) => Promise<void>;
  onNewRequest: () => void;
  onCreateFolder: (name: string) => void;
}

const CollectionRow: React.FC<CollectionRowProps> = ({
  collection,
  meta,
  containsActive,
  onRename,
  onDelete,
  onExport,
  onSetAuth,
  onNewRequest,
  onCreateFolder
}) => {
  const [isRenaming, setIsRenaming] = useState(false);
  const [draftName, setDraftName] = useState(collection.name);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [draftFolderName, setDraftFolderName] = useState('');
  const [isEditingAuth, setIsEditingAuth] = useState(false);

  // TreeList only knows a drag is hovering this node -- validity (same collection, and only
  // folders/requests are ever dragged) is decided here, same rule as the storybook demo.
  const isValidDropTarget =
    meta.draggingNode !== null && nodeCollectionId(meta.draggingNode) === collection.id;

  const commitRename = (): void => {
    setIsRenaming(false);
    const trimmed = draftName.trim();
    if (trimmed && trimmed !== collection.name) onRename(trimmed);
  };

  const submitNewFolder = (): void => {
    const name = draftFolderName.trim();
    setIsCreatingFolder(false);
    setDraftFolderName('');
    if (name) onCreateFolder(name);
  };

  const totalCount = countRequestsRecursive(collection);

  return (
    <>
      <TreeList.Item
        meta={meta}
        dragMode="target"
        isDropTarget={meta.isDropTarget && isValidDropTarget}
        // A collection is never itself "selected" (only a request/example backs a tab) --
        // only highlight it as a stand-in for the active descendant while that descendant
        // is actually hidden (collapsed). Once expanded, the descendant's own row carries
        // the highlight, so showing it here too would just be a second, redundant highlight.
        isActive={containsActive && !meta.isExpanded}
        title="Drop here to move to collection root"
        className="gap-1 px-1"
        actions={
          !isRenaming && (
            <ActionsMenu
              triggerTitle="Collection actions"
              actions={[
                { icon: <Send size={12} />, label: 'New Request', onClick: onNewRequest },
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
                {
                  icon: <KeyRound size={12} />,
                  label: 'Authorization',
                  onClick: () => setIsEditingAuth(true)
                },
                { icon: <Download size={12} />, label: 'Export', onClick: onExport },
                { icon: <Trash2 size={12} />, label: 'Delete', danger: true, onClick: onDelete }
              ]}
            />
          )
        }
      >
        {meta.hasChildren ? (
          <button
            onClick={meta.toggleExpanded}
            title={meta.isExpanded ? 'Collapse' : 'Expand'}
            className="text-zinc-500 hover:text-foreground cursor-pointer shrink-0"
          >
            <TreeList.ExpandToggle hasChildren isExpanded={meta.isExpanded} />
          </button>
        ) : (
          <TreeList.ExpandToggle hasChildren={false} isExpanded={false} />
        )}

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
            className="flex-1 bg-surface-3 border border-accent rounded px-1.5 py-0.5 text-xs text-zinc-200 focus:outline-none"
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
      </TreeList.Item>

      <AuthorizationDialog
        open={isEditingAuth}
        onOpenChange={setIsEditingAuth}
        title={`${collection.name} Authorization`}
        auth={collection.auth}
        onSave={onSetAuth}
      />

      {isCreatingFolder && meta.isExpanded && (
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
          style={{ marginLeft: meta.indentPx + 16 }}
          className="bg-surface-3 border border-accent rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none mt-0.5"
        />
      )}
    </>
  );
};

interface FolderRowProps {
  folder: CollectionFolder;
  collectionId: string;
  meta: TreeItemMeta<CollectionTreeNode>;
  /** Whether the active request/example lives somewhere inside this folder -- never "this folder itself is selected", since a folder is never what backs an open tab. */
  containsActive: boolean;
  onRename: (name: string) => void;
  onDelete: () => void;
  onSetAuth: (auth: HttpAuth) => Promise<void>;
  onNewRequest: () => void;
  onCreateFolder: (name: string) => void;
  moveFolders: CollectionFolder[];
  onMove: (targetFolderId: string | null) => void;
}

const FolderRow: React.FC<FolderRowProps> = ({
  folder,
  collectionId,
  meta,
  containsActive,
  onRename,
  onDelete,
  onSetAuth,
  onNewRequest,
  onCreateFolder,
  moveFolders,
  onMove
}) => {
  const [isRenaming, setIsRenaming] = useState(false);
  const [draftName, setDraftName] = useState(folder.name);
  const [isCreatingSubfolder, setIsCreatingSubfolder] = useState(false);
  const [draftSubfolderName, setDraftSubfolderName] = useState('');
  const [isEditingAuth, setIsEditingAuth] = useState(false);

  // Same collection, and (if a folder is being dragged) not into itself or one of its own
  // subfolders -- requests have no further restriction beyond same-collection.
  const { draggingNode } = meta;
  const isValidDropTarget =
    draggingNode !== null &&
    nodeCollectionId(draggingNode) === collectionId &&
    !(draggingNode.kind === 'folder' && isFolderOrDescendant(draggingNode.folder, folder.id));

  const commitRename = (): void => {
    setIsRenaming(false);
    const trimmed = draftName.trim();
    if (trimmed && trimmed !== folder.name) onRename(trimmed);
  };

  const submitSubfolder = (): void => {
    const name = draftSubfolderName.trim();
    setIsCreatingSubfolder(false);
    setDraftSubfolderName('');
    if (name) onCreateFolder(name);
  };

  return (
    <>
      <TreeList.Item
        meta={meta}
        onClick={meta.toggleExpanded}
        dragMode="both"
        isDropTarget={meta.isDropTarget && isValidDropTarget}
        // Same rule as CollectionRow: stand in for the active descendant only while
        // it's actually hidden (collapsed) -- expanded, the descendant's own row
        // already carries the highlight.
        isActive={containsActive && !meta.isExpanded}
        title={meta.isExpanded ? 'Collapse folder' : 'Expand folder'}
        className="gap-1 px-1 cursor-grab active:cursor-grabbing"
        actions={
          !isRenaming && (
            <ActionsMenu
              triggerTitle="Folder actions"
              actions={[
                { icon: <Send size={12} />, label: 'New Request', onClick: onNewRequest },
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
                  icon: <KeyRound size={12} />,
                  label: 'Authorization',
                  onClick: () => setIsEditingAuth(true)
                },
                { icon: <Trash2 size={12} />, label: 'Delete', danger: true, onClick: onDelete }
              ]}
              moveTo={{ folders: moveFolders, excludeId: folder.id, onSelect: onMove }}
            />
          )
        }
      >
        <TreeList.ExpandToggle hasChildren={meta.hasChildren} isExpanded={meta.isExpanded} />
        {meta.isExpanded ? (
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
            className="flex-1 bg-surface-3 border border-accent rounded px-1.5 py-0.5 text-xs text-zinc-200 focus:outline-none"
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
      </TreeList.Item>

      <AuthorizationDialog
        open={isEditingAuth}
        onOpenChange={setIsEditingAuth}
        title={`${folder.name} Authorization`}
        auth={folder.auth}
        onSave={onSetAuth}
      />

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
          style={{ marginLeft: meta.indentPx + 16 }}
          className="bg-surface-3 border border-accent rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none mt-0.5"
        />
      )}
    </>
  );
};

interface RequestRowProps {
  request: SavedRequest;
  meta: TreeItemMeta<CollectionTreeNode>;
  isActive: boolean;
  onOpen: (options?: { preview?: boolean }) => void;
  onRename: (name: string) => void;
  onDelete: () => void;
  moveFolders: CollectionFolder[];
  onMove: (targetFolderId: string | null) => void;
}

const RequestRow: React.FC<RequestRowProps> = ({
  request,
  meta,
  isActive,
  onOpen,
  onRename,
  onDelete,
  moveFolders,
  onMove
}) => {
  const [isRenaming, setIsRenaming] = useState(false);
  const [draftName, setDraftName] = useState(request.name);
  const examples = request.examples ?? [];
  const hasExamples = examples.length > 0;

  const commitRename = (): void => {
    setIsRenaming(false);
    const trimmed = draftName.trim();
    if (trimmed && trimmed !== request.name) onRename(trimmed);
  };

  if (isRenaming) {
    return (
      <div
        style={{ paddingLeft: meta.indentPx }}
        className="flex items-center gap-2 p-1.5 rounded border border-accent bg-surface-3"
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
    <TreeList.Item
      meta={meta}
      dragMode="source"
      isActive={isActive}
      onClick={() => onOpen()}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onOpen({ preview: false });
      }}
      title={`${request.url}\nDouble-click to open in a permanent tab`}
      className="text-xs text-foreground cursor-grab active:cursor-grabbing"
      actions={
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
      }
    >
      {hasExamples && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            meta.toggleExpanded();
          }}
          title={meta.isExpanded ? 'Hide examples' : 'Show examples'}
          className="text-zinc-500 hover:text-foreground cursor-pointer shrink-0"
        >
          <TreeList.ExpandToggle hasChildren isExpanded={meta.isExpanded} size={11} />
        </button>
      )}
      <RequestMethodBadge request={request} />
      <span
        className={`truncate flex-1 ${isActive ? 'text-foreground' : 'text-zinc-300 group-hover:text-foreground'}`}
      >
        {request.name}
      </span>
      {hasExamples && (
        <span
          title={`${examples.length} saved example${examples.length === 1 ? '' : 's'}`}
          className="text-[9px] text-zinc-600 shrink-0"
        >
          {examples.length}
        </span>
      )}
    </TreeList.Item>
  );
};

interface ExampleRowProps {
  example: SavedExample;
  meta: TreeItemMeta<CollectionTreeNode>;
  isActive: boolean;
  onOpen: (options?: { preview?: boolean }) => void;
  onRename: (name: string) => void;
  onDelete: () => void;
}

const ExampleRow: React.FC<ExampleRowProps> = ({
  example,
  meta,
  isActive,
  onOpen,
  onRename,
  onDelete
}) => {
  const [isRenaming, setIsRenaming] = useState(false);
  const [draftName, setDraftName] = useState(example.name);

  const commitRename = (): void => {
    setIsRenaming(false);
    const trimmed = draftName.trim();
    if (trimmed && trimmed !== example.name) onRename(trimmed);
  };

  if (isRenaming) {
    return (
      <div
        style={{ paddingLeft: meta.indentPx }}
        className="flex items-center gap-2 p-1.5 rounded border border-accent bg-surface-3"
      >
        <Bookmark size={11} className="text-zinc-500 shrink-0" />
        <input
          type="text"
          autoFocus
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitRename();
            if (e.key === 'Escape') {
              setDraftName(example.name);
              setIsRenaming(false);
            }
          }}
          className="flex-1 bg-transparent text-xs text-zinc-200 focus:outline-none min-w-0"
        />
      </div>
    );
  }

  return (
    <TreeList.Item
      meta={meta}
      dragMode="none"
      isActive={isActive}
      onClick={() => onOpen()}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onOpen({ preview: false });
      }}
      title={`${example.response.status === 0 ? 'ERROR' : `${example.response.status} ${example.response.statusText}`}\nDouble-click to open in a permanent tab`}
      className="text-xs cursor-pointer"
      actions={
        <ActionsMenu
          idleContent={
            <span className="text-[9px] text-zinc-600 shrink-0">
              {example.response.status === 0 ? 'ERR' : example.response.status}
            </span>
          }
          triggerTitle="Example actions"
          actions={[
            {
              icon: <Pencil size={12} />,
              label: 'Rename',
              onClick: () => {
                setDraftName(example.name);
                setIsRenaming(true);
              }
            },
            { icon: <Trash2 size={12} />, label: 'Delete', danger: true, onClick: onDelete }
          ]}
        />
      }
    >
      <Bookmark size={11} className={`shrink-0 ${exampleStatusClass(example.response.status)}`} />
      <span
        className={`truncate flex-1 ${isActive ? 'text-foreground' : 'text-zinc-400 group-hover:text-foreground'}`}
      >
        {example.name}
      </span>
    </TreeList.Item>
  );
};
