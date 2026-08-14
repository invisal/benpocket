import type React from 'react';
import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { ChevronDown, Plus, X } from 'lucide-react';
import { cn } from 'cnfast';
import { useCollectionsStore } from '../store/collections.store';
import type { RequestProtocol, SavedRequest } from '../../../../preload/http-client/types';
import type { HttpState } from '../hooks/useHttp';
import type { SavedBinding } from '../types';
import { DEFAULT_HTTP_AUTH } from '../lib/auth';
import { makeId } from '../lib/makeId';
import { Button } from '@renderer/components/ui/Button';
import { Menu } from '@renderer/components/ui/Menu';

export interface RequestSaveBarHandle {
  /** Saves using whatever collection/name is currently set in the bar - used by the Ctrl+S / Cmd+S shortcut. */
  save: () => void;
}

interface RequestSaveBarProps {
  tabTitle: string;
  protocol: RequestProtocol;
  url: string;
  /** HTTP-only. */
  request?: HttpState;
  binding: SavedBinding | null;
  /** Pre-select this collection on first load, e.g. when the tab was opened via "new request in folder". Ignored once `binding` is set. */
  defaultCollectionId?: string;
  onSaved: (binding: SavedBinding, name: string) => void;
  onError: (message: string) => void;
  /** Extra buttons rendered before Save, e.g. a "Code" snippet trigger. */
  extraActions?: React.ReactNode;
}

export const RequestSaveBar = forwardRef<RequestSaveBarHandle, RequestSaveBarProps>(
  (
    {
      tabTitle,
      protocol,
      url,
      request,
      binding,
      defaultCollectionId,
      onSaved,
      onError,
      extraActions
    },
    ref
  ) => {
    const { collections, isLoaded, load, createCollection, saveRequest } = useCollectionsStore();

    const [name, setName] = useState(tabTitle);
    const [collectionId, setCollectionId] = useState(binding?.collectionId ?? '');
    const [isCreatingCollection, setIsCreatingCollection] = useState(false);
    const [newCollectionName, setNewCollectionName] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
      if (!isLoaded) load();
    }, [isLoaded, load]);

    // Once collections have loaded, pick a sane default destination if the bar
    // doesn't already have one (e.g. a request bound to an existing collection).
    const [hasPickedDefault, setHasPickedDefault] = useState(false);
    if (!hasPickedDefault && isLoaded) {
      setHasPickedDefault(true);
      if (!collectionId) {
        const fallback =
          defaultCollectionId && collections.some((c) => c.id === defaultCollectionId)
            ? defaultCollectionId
            : (collections[0]?.id ?? '');
        if (fallback) setCollectionId(fallback);
        else setIsCreatingCollection(true);
      }
    }

    const handleSave = async (): Promise<void> => {
      const trimmedName = name.trim() || 'Untitled Request';
      setIsSaving(true);
      try {
        let targetCollectionId = collectionId;
        if (isCreatingCollection || !targetCollectionId) {
          const created = await createCollection(newCollectionName.trim() || 'Untitled Collection');
          targetCollectionId = created.id;
        }
        if (!targetCollectionId) return;

        const requestId =
          binding && binding.collectionId === targetCollectionId
            ? binding.requestId
            : makeId('req');
        const savedRequest: SavedRequest =
          protocol === 'HTTP'
            ? {
                id: requestId,
                name: trimmedName,
                protocol: 'HTTP',
                method: request?.method ?? 'GET',
                url,
                headers: request?.headers ?? [],
                params: request?.params ?? [],
                bodyType: request?.bodyType ?? 'none',
                body: request?.body ?? '',
                auth: request?.auth ?? DEFAULT_HTTP_AUTH,
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
        await saveRequest(targetCollectionId, savedRequest, null);
        setCollectionId(targetCollectionId);
        setIsCreatingCollection(false);
        onSaved({ collectionId: targetCollectionId, requestId }, trimmedName);
      } catch (err) {
        onError(err instanceof Error ? err.message : 'Save failed.');
      } finally {
        setIsSaving(false);
      }
    };

    useImperativeHandle(ref, () => ({ save: handleSave }));

    // Creates the collection as soon as its name is committed (Enter / blur) rather than
    // waiting for the main Save button, so the picker immediately reflects the new target.
    const commitNewCollection = (): void => {
      const trimmed = newCollectionName.trim();
      setIsCreatingCollection(false);
      setNewCollectionName('');
      if (!trimmed) return;
      createCollection(trimmed)
        .then((created) => setCollectionId(created.id))
        .catch((err: unknown) => {
          onError(err instanceof Error ? err.message : 'Something went wrong.');
        });
    };

    const selectedCollectionName = collections.find((c) => c.id === collectionId)?.name;

    return (
      <div className="text-xs px-3 pb-3 pt-3 flex justify-between items-center gap-3">
        <div className="flex items-center gap-1 min-w-0">
          {isCreatingCollection ? (
            <span className="flex items-center gap-1">
              <input
                type="text"
                autoFocus
                placeholder="New collection name..."
                value={newCollectionName}
                onChange={(e) => setNewCollectionName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitNewCollection();
                  if (e.key === 'Escape' && collections.length > 0) {
                    setIsCreatingCollection(false);
                    setNewCollectionName('');
                  }
                }}
                className="bg-transparent text-muted-foreground outline-none border-b border-accent w-32 truncate"
              />
              {collections.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setIsCreatingCollection(false);
                    setNewCollectionName('');
                  }}
                  title="Choose an existing collection"
                  className="p-0.5 text-muted-foreground hover:text-foreground cursor-pointer shrink-0"
                >
                  <X size={11} />
                </button>
              )}
            </span>
          ) : (
            <Menu.Root>
              <Menu.Trigger
                title="Collection to save into"
                className="flex items-center gap-1 h-6 px-1.5 rounded max-w-32 text-muted-foreground hover:text-foreground hover:bg-surface-2 cursor-pointer"
              >
                <span className="truncate">{selectedCollectionName ?? 'Select collection'}</span>
                <ChevronDown size={11} className="shrink-0" />
              </Menu.Trigger>
              <Menu.Content align="start">
                {collections.map((c) => (
                  <Menu.Item key={c.id} onClick={() => setCollectionId(c.id)}>
                    <span className="truncate">{c.name}</span>
                  </Menu.Item>
                ))}
                {collections.length > 0 && <Menu.Separator />}
                <Menu.Item
                  onClick={() => {
                    setIsCreatingCollection(true);
                    setNewCollectionName('');
                  }}
                >
                  <Plus size={12} className="shrink-0" />
                  <span>New collection</span>
                </Menu.Item>
              </Menu.Content>
            </Menu.Root>
          )}

          <span className="text-muted-foreground shrink-0">/</span>

          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Unnamed Request"
            className={cn(
              'flex-1 min-w-0 bg-transparent font-medium text-foreground outline-none truncate',
              'border-b border-transparent focus:border-accent'
            )}
          />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {extraActions}
          <Button onClick={handleSave} disabled={isSaving} title="Save (Ctrl+S / ⌘S)">
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>
    );
  }
);

RequestSaveBar.displayName = 'RequestSaveBar';
