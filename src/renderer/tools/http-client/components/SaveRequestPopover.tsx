import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Popover } from '@base-ui/react/popover';
import { Save } from 'lucide-react';
import { useCollectionsStore } from '../store/collections.store';
import type {
  HttpBodyType,
  HttpMethod,
  RequestProtocol,
  SavedRequest
} from '../../../../preload/http-client/types';
import type { KeyValueRow } from '../lib/keyValueRows';
import type { SavedBinding } from '../types';
import { findRequestInContainer, flattenFolderOptions } from '../lib/collectionTree';

interface SaveRequestPopoverProps {
  tabTitle: string;
  protocol: RequestProtocol;
  url: string;
  /** HTTP-only. */
  method?: HttpMethod;
  headers?: KeyValueRow[];
  params?: KeyValueRow[];
  bodyType?: HttpBodyType;
  body?: string;
  binding: SavedBinding | null;
  /** Pre-select this collection/folder on first open, e.g. when the tab was opened via "new request in folder". Ignored once `binding` is set. */
  defaultCollectionId?: string;
  defaultFolderId?: string | null;
  onSaved: (binding: SavedBinding, name: string) => void;
}

function makeRequestId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `req-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export const SaveRequestPopover: React.FC<SaveRequestPopoverProps> = ({
  tabTitle,
  protocol,
  method,
  url,
  headers,
  params,
  bodyType,
  body,
  binding,
  defaultCollectionId,
  defaultFolderId,
  onSaved
}) => {
  const { collections, isLoaded, load, createCollection, saveRequest } = useCollectionsStore();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(tabTitle);
  const [collectionId, setCollectionId] = useState('');
  const [folderId, setFolderId] = useState<string>('');
  const [isCreatingCollection, setIsCreatingCollection] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isLoaded) load();
  }, [isLoaded, load]);

  // Re-derive defaults each time the popover is (re)opened - adjusted directly
  // during render (rather than in an effect) and guarded by `wasOpen` so it
  // only fires on the closed-to-open transition, matching the previous
  // effect's `[open]`-only dependency array.
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      const boundCollection = binding
        ? collections.find((c) => c.id === binding.collectionId)
        : undefined;
      const boundRequest =
        boundCollection && binding
          ? findRequestInContainer(boundCollection, binding.requestId)
          : undefined;
      setName(boundRequest?.name ?? tabTitle);
      if (binding) {
        setCollectionId(boundCollection?.id ?? collections[0]?.id ?? '');
        setFolderId('');
      } else {
        const fallsBackTo =
          defaultCollectionId && collections.some((c) => c.id === defaultCollectionId);
        setCollectionId(fallsBackTo ? defaultCollectionId! : (collections[0]?.id ?? ''));
        setFolderId(fallsBackTo ? (defaultFolderId ?? '') : '');
      }
      setIsCreatingCollection(collections.length === 0);
      setNewCollectionName('');
    }
  }

  const isUpdatingExisting = !!binding && binding.collectionId === collectionId;
  const selectedCollection = collections.find((c) => c.id === collectionId);
  const folderOptions = useMemo(
    () => (selectedCollection ? flattenFolderOptions(selectedCollection.folders) : []),
    [selectedCollection]
  );

  const handleConfirm = async (): Promise<void> => {
    const trimmedName = name.trim() || 'Untitled Request';
    setIsSaving(true);
    try {
      let targetCollectionId = collectionId;
      if (isCreatingCollection) {
        const created = await createCollection(newCollectionName.trim() || 'Untitled Collection');
        targetCollectionId = created.id;
      }
      if (!targetCollectionId) return;

      const requestId =
        binding && binding.collectionId === targetCollectionId
          ? binding.requestId
          : makeRequestId();
      const request: SavedRequest =
        protocol === 'HTTP'
          ? {
              id: requestId,
              name: trimmedName,
              protocol: 'HTTP',
              method: method ?? 'GET',
              url,
              headers: headers ?? [],
              params: params ?? [],
              bodyType: bodyType ?? 'none',
              body: body ?? '',
              updatedAt: Date.now()
            }
          : {
              id: requestId,
              name: trimmedName,
              protocol: 'WEBSOCKET',
              method: 'GET',
              url,
              headers: [],
              params: [],
              bodyType: 'none',
              body: '',
              updatedAt: Date.now()
            };
      await saveRequest(targetCollectionId, request, folderId || null);
      onSaved({ collectionId: targetCollectionId, requestId }, trimmedName);
      setOpen(false);
    } finally {
      setIsSaving(false);
    }
  };

  const canConfirm =
    name.trim().length > 0 &&
    (isCreatingCollection ? newCollectionName.trim().length > 0 : collectionId);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        title="Save to a collection (Ctrl+S / ⌘S quick-saves if already saved)"
        className="px-3 py-1.5 bg-sidebar-bg border border-border-dark hover:border-accent text-zinc-300 hover:text-white text-xs font-semibold rounded flex items-center gap-1.5 cursor-pointer transition-colors"
      >
        <Save size={12} />
        <span>Save</span>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={8} align="end" className="z-50">
          <Popover.Popup className="bg-sidebar-bg border border-border-dark rounded-lg shadow-xl p-3 w-72 flex flex-col gap-3 text-xs outline-none">
            <div className="font-bold text-zinc-300 uppercase tracking-wider text-[10px]">
              Save Request
            </div>

            <label className="flex flex-col gap-1">
              <span className="text-zinc-500">Request name</span>
              <input
                type="text"
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-editor-bg border border-border-dark rounded px-2 py-1.5 text-zinc-200 focus:outline-none focus:border-accent"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-zinc-500">Collection</span>
              {isCreatingCollection ? (
                <input
                  type="text"
                  placeholder="New collection name..."
                  value={newCollectionName}
                  onChange={(e) => setNewCollectionName(e.target.value)}
                  className="bg-editor-bg border border-accent rounded px-2 py-1.5 text-zinc-200 focus:outline-none"
                />
              ) : (
                <select
                  value={collectionId}
                  onChange={(e) => {
                    setCollectionId(e.target.value);
                    setFolderId('');
                  }}
                  className="bg-editor-bg border border-border-dark rounded px-2 py-1.5 text-zinc-200 focus:outline-none focus:border-accent cursor-pointer"
                >
                  {collections.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              )}
              {collections.length > 0 && (
                <button
                  type="button"
                  onClick={() => setIsCreatingCollection((v) => !v)}
                  className="self-start text-[10px] text-accent hover:underline cursor-pointer"
                >
                  {isCreatingCollection ? 'Choose existing collection' : '+ New collection'}
                </button>
              )}
            </label>

            {!isCreatingCollection && !isUpdatingExisting && folderOptions.length > 0 && (
              <label className="flex flex-col gap-1">
                <span className="text-zinc-500">Folder</span>
                <select
                  value={folderId}
                  onChange={(e) => setFolderId(e.target.value)}
                  className="bg-editor-bg border border-border-dark rounded px-2 py-1.5 text-zinc-200 focus:outline-none focus:border-accent cursor-pointer"
                >
                  <option value="">Collection Root</option>
                  {folderOptions.map((f) => (
                    <option key={f.id} value={f.id}>
                      {'—'.repeat(f.depth)} {f.name}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <div className="flex justify-end gap-2 mt-1">
              <Popover.Close className="px-3 py-1.5 text-zinc-400 hover:text-white text-xs cursor-pointer">
                Cancel
              </Popover.Close>
              <button
                onClick={handleConfirm}
                disabled={!canConfirm || isSaving}
                className="px-3 py-1.5 bg-accent/80 hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed text-white rounded cursor-pointer font-semibold transition-colors"
              >
                {isSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
};
