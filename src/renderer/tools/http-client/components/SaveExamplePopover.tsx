import type React from 'react';
import { useState } from 'react';
import { Popover } from '@base-ui/react/popover';
import { Bookmark } from 'lucide-react';
import { useCollectionsStore } from '../store/collections.store';
import type {
  HttpAuth,
  HttpBodyType,
  HttpMethod,
  HttpResponsePayload
} from '../../../../preload/http-client/types';
import type { KeyValueRow } from '../lib/keyValueRows';
import type { SavedBinding } from '../types';
import { makeId } from '../lib/makeId';

interface SaveExamplePopoverProps {
  /** Which saved request to attach the example to - the trigger is disabled without one. */
  binding: SavedBinding | null;
  response: HttpResponsePayload | null;
  method: HttpMethod;
  url: string;
  headers: KeyValueRow[];
  params: KeyValueRow[];
  bodyType: HttpBodyType;
  body: string;
  auth: HttpAuth;
}

export const SaveExamplePopover: React.FC<SaveExamplePopoverProps> = ({
  binding,
  response,
  method,
  url,
  headers,
  params,
  bodyType,
  body,
  auth
}) => {
  const saveExample = useCollectionsStore((s) => s.saveExample);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const disabled = !binding || !response;

  // Re-derive the default name each time the popover is (re)opened - adjusted directly
  // during render (rather than in an effect), guarded by `wasOpen` so it only fires on
  // the closed-to-open transition, matching the pattern used by SaveRequestPopover.
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open && response) {
      setName(response.status === 0 ? 'Error' : `${response.status} ${response.statusText}`.trim());
    }
  }

  const handleConfirm = async (): Promise<void> => {
    if (!binding || !response) return;
    const trimmedName = name.trim() || 'Example';
    setIsSaving(true);
    try {
      await saveExample(binding.collectionId, binding.requestId, {
        id: makeId('ex'),
        name: trimmedName,
        createdAt: Date.now(),
        request: {
          method,
          url,
          headers: headers.filter((h) => h.key.trim()),
          params: params.filter((p) => p.key.trim()),
          bodyType,
          body,
          auth
        },
        response
      });
      setOpen(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Popover.Root open={open} onOpenChange={(next) => !disabled && setOpen(next)}>
      <Popover.Trigger
        disabled={disabled}
        title={
          disabled
            ? 'Save the request to a collection and send it first.'
            : 'Save this response as an example on the saved request'
        }
        className="px-3 py-1.5 bg-surface-2 border border-border-dark hover:border-accent disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-border-dark text-zinc-300 hover:text-foreground text-xs font-semibold rounded flex items-center gap-1.5 cursor-pointer transition-colors"
      >
        <Bookmark size={12} />
        <span>Save Example</span>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={8} align="end" className="z-50">
          <Popover.Popup className="bg-surface border border-border-dark rounded-lg shadow-xl p-3 w-72 flex flex-col gap-3 text-xs outline-none">
            <div className="font-bold text-zinc-300 uppercase tracking-wider text-[10px]">
              Save Response as Example
            </div>

            <label className="flex flex-col gap-1">
              <span className="text-zinc-500">Example name</span>
              <input
                type="text"
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-surface-2 border border-border rounded px-2 py-1.5 text-zinc-200 focus:outline-none focus:border-accent"
              />
            </label>

            <div className="flex justify-end gap-2 mt-1">
              <Popover.Close className="px-3 py-1.5 text-zinc-400 hover:text-foreground text-xs cursor-pointer">
                Cancel
              </Popover.Close>
              <button
                onClick={handleConfirm}
                disabled={!name.trim() || isSaving}
                className="px-3 py-1.5 bg-accent/80 hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed text-emphasis-text rounded cursor-pointer font-semibold transition-colors"
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
