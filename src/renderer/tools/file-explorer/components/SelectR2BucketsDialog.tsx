import { useEffect, useState } from 'react';
import { cn } from 'cnfast';
import { Dialog } from '@renderer/components/ui/Dialog';
import { Button } from '@renderer/components/ui/Button';

interface SelectR2BucketsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

type LoadState = 'loading' | 'ready' | 'error';

export function SelectR2BucketsDialog({ open, onOpenChange, onSaved }: SelectR2BucketsDialogProps) {
  const [state, setState] = useState<LoadState>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [buckets, setBuckets] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    Promise.all([window.fileExplorer.listR2Buckets(), window.fileExplorer.getR2CredentialStatus()])
      .then(([bucketsResult, status]) => {
        if ('error' in bucketsResult) {
          setErrorMessage(bucketsResult.error);
          setState('error');
          return;
        }
        setBuckets(bucketsResult.map((bucket) => bucket.name));
        setSelected(new Set(status.selectedBuckets));
        setState('ready');
      })
      .catch(() => {
        setErrorMessage('Failed to load R2 buckets.');
        setState('error');
      });
  }, [open]);

  const toggleBucket = (name: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    const result = await window.fileExplorer.setSelectedR2Buckets(Array.from(selected));
    setSaving(false);
    if ('error' in result) {
      setErrorMessage(result.error);
      setState('error');
      return;
    }
    onSaved();
    onOpenChange(false);
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content className="max-w-sm">
        <Dialog.Title>Select R2 Buckets</Dialog.Title>
        <Dialog.Description>
          Pick which buckets show up in the sidebar and location picker.
        </Dialog.Description>

        <div className="mt-4">
          {state === 'loading' && <p className="text-xs text-text-dim">Loading buckets…</p>}
          {state === 'error' && <p className="text-xs text-red-400">{errorMessage}</p>}
          {state === 'ready' && (
            <div className="flex flex-col gap-3">
              {buckets.length === 0 ? (
                <p className="text-xs text-text-dim">No buckets found on this account.</p>
              ) : (
                <div className="flex max-h-64 flex-col gap-0.5 overflow-y-auto">
                  {buckets.map((name) => (
                    <label
                      key={name}
                      className={cn(
                        'flex items-center gap-2 rounded px-2 py-1 text-xs cursor-pointer',
                        'hover:bg-surface-3'
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(name)}
                        onChange={() => toggleBucket(name)}
                      />
                      <span className="truncate">{name}</span>
                    </label>
                  ))}
                </div>
              )}
              <div>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => void handleSave()}
                  disabled={saving}
                >
                  {saving ? 'Saving…' : 'Save'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </Dialog.Content>
    </Dialog.Root>
  );
}
