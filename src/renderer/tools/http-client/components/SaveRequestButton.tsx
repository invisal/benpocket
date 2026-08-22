import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { ChevronDown, Plus, Save, X } from 'lucide-react';
import { Popover } from '@base-ui/react/popover';
import { useCollectionsStore } from '../store/collections.store';
import type { RequestProtocol, SavedRequest } from '../../../../preload/http-client/types';
import type { HttpState } from '../hooks/useHttp';
import type { SavedBinding } from '../types';
import { DEFAULT_HTTP_AUTH } from '../lib/auth';
import { makeId } from '../lib/makeId';
import { Button } from '@renderer/components/ui/Button';
import { Menu } from '@renderer/components/ui/Menu';

export interface SaveRequestButtonHandle {
  /** Saves using the current binding, or opens the collection picker if unbound - used by Ctrl+S / Cmd+S. */
  save: () => void;
}

interface SaveRequestButtonProps {
  /** Used as the saved request's name - the tab title is the single source of truth for it (rename via the sidebar's open-tabs list). */
  tabTitle: string;
  protocol: RequestProtocol;
  url: string;
  /** HTTP-only. */
  request?: HttpState;
  binding: SavedBinding | null;
  /** Pre-select this collection on first load, e.g. when the tab was opened via "new request in folder". Ignored once `binding` is set. */
  defaultCollectionId?: string;
  onSaved: (binding: SavedBinding) => void;
  onError: (message: string) => void;
}

/** Compact icon-button replacement for the old always-visible save bar: a bound request saves
 * in place on click, an unbound one pops open a small collection picker instead of reserving a
 * permanent row of screen space. */
export const SaveRequestButton = forwardRef<SaveRequestButtonHandle, SaveRequestButtonProps>(
  ({ tabTitle, protocol, url, request, binding, defaultCollectionId, onSaved, onError }, ref) => {
    const { collections, isLoaded, load, createCollection, saveRequest } = useCollectionsStore();

    const [open, setOpen] = useState(false);
    const [collectionId, setCollectionId] = useState(binding?.collectionId ?? '');
    const [isCreatingCollection, setIsCreatingCollection] = useState(false);
    const [newCollectionName, setNewCollectionName] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
      if (!isLoaded) load();
    }, [isLoaded, load]);

    const saveToCollection = async (targetCollectionId: string): Promise<void> => {
      const trimmedName = tabTitle.trim() || 'Untitled Request';
      setIsSaving(true);
      try {
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
        onSaved({ collectionId: targetCollectionId, requestId });
        setOpen(false);
      } catch (err) {
        onError(err instanceof Error ? err.message : 'Save failed.');
      } finally {
        setIsSaving(false);
      }
    };

    // Seeds the picker with a sane default destination when it's about to open for an
    // unbound request: the tab's preset collection if it still exists, else the first one.
    const openPicker = (): void => {
      const fallback =
        defaultCollectionId && collections.some((c) => c.id === defaultCollectionId)
          ? defaultCollectionId
          : (collections[0]?.id ?? '');
      setCollectionId(fallback);
      setIsCreatingCollection(!fallback);
      setOpen(true);
    };

    const handleSave = (): void => {
      if (binding) void saveToCollection(binding.collectionId);
      else openPicker();
    };

    useImperativeHandle(ref, () => ({ save: handleSave }));

    const handleConfirm = async (): Promise<void> => {
      let targetCollectionId = collectionId;
      if (isCreatingCollection || !targetCollectionId) {
        const created = await createCollection(newCollectionName.trim() || 'Untitled Collection');
        targetCollectionId = created.id;
      }
      if (!targetCollectionId) return;
      await saveToCollection(targetCollectionId);
    };

    const selectedCollectionName = collections.find((c) => c.id === collectionId)?.name;

    // A bound request saves in place with a plain button - the picker below only exists to
    // choose a destination collection the first time, so it stays unmounted once that's settled.
    if (binding) {
      return (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSave}
          disabled={isSaving}
          title="Save (Ctrl+S / ⌘S)"
          className="px-1.5 hover:bg-surface-3"
        >
          <Save size={13} />
        </Button>
      );
    }

    return (
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger
          onClick={handleSave}
          title="Save to a collection (Ctrl+S / ⌘S)"
          render={<Button variant="ghost" size="sm" className="px-1.5 hover:bg-surface-3" />}
        >
          <Save size={13} />
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner sideOffset={8} align="end" className="z-50">
            <Popover.Popup className="bg-surface border border-border-dark rounded-lg shadow-xl p-3 w-72 flex flex-col gap-3 text-xs outline-none">
              <div className="font-bold text-zinc-300 uppercase tracking-wider text-[10px]">
                Save to Collection
              </div>

              {isCreatingCollection ? (
                <span className="flex items-center gap-1">
                  <input
                    type="text"
                    autoFocus
                    placeholder="New collection name..."
                    value={newCollectionName}
                    onChange={(e) => setNewCollectionName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void handleConfirm();
                    }}
                    className="flex-1 bg-surface-2 border border-border rounded px-2 py-1.5 text-zinc-200 focus:outline-none focus:border-accent min-w-0"
                  />
                  {collections.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsCreatingCollection(false);
                        setNewCollectionName('');
                      }}
                      title="Choose an existing collection"
                      className="p-1 text-muted-foreground hover:text-foreground cursor-pointer shrink-0"
                    >
                      <X size={12} />
                    </button>
                  )}
                </span>
              ) : (
                <Menu.Root>
                  <Menu.Trigger
                    title="Collection to save into"
                    className="flex items-center justify-between gap-1 h-8 px-2 rounded border border-border bg-surface-2 text-zinc-200 hover:bg-surface-3 cursor-pointer"
                  >
                    <span className="truncate">
                      {selectedCollectionName ?? 'Select collection'}
                    </span>
                    <ChevronDown size={12} className="shrink-0" />
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

              <div className="flex justify-end gap-2 mt-1">
                <Popover.Close render={<Button variant="ghost" size="sm" />}>Cancel</Popover.Close>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleConfirm}
                  disabled={isSaving || (!isCreatingCollection && !collectionId)}
                >
                  {isSaving ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    );
  }
);

SaveRequestButton.displayName = 'SaveRequestButton';
