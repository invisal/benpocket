import type React from 'react';
import { useState } from 'react';
import { Popover } from '@base-ui/react/popover';
import { Button } from '@renderer/components/ui/Button';
import { useCollectionsStore } from '../store/collections.store';
import type { HttpResponsePayload } from '../../../../preload/http-client/types';
import type { HttpState } from '../hooks/useHttp';
import type { SavedBinding } from '../types';
import { makeId } from '../lib/makeId';

interface SaveExamplePopoverProps {
  /** Which saved request to attach the example to - the trigger is disabled without one. */
  binding: SavedBinding | null;
  response: HttpResponsePayload | null;
  request: HttpState;
}

export const SaveExamplePopover: React.FC<SaveExamplePopoverProps> = ({
  binding,
  response,
  request
}) => {
  const { method, url, headers, params, bodyType, body, auth } = request;
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
        render={<Button variant="secondary" size="md" />}
      >
        Save Example
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
              <Popover.Close render={<Button variant="ghost" size="sm" />}>Cancel</Popover.Close>
              <Button
                variant="primary"
                size="sm"
                onClick={handleConfirm}
                disabled={!name.trim() || isSaving}
              >
                {isSaving ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
};
