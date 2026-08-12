import type { JSX } from 'react';
import { Dialog } from '@renderer/components/ui/Dialog';
import { Button } from '@renderer/components/ui/Button';

interface DiscardChangesDialogProps {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Guards `useOpenProject.openProject` switching to a different project (or reloading the current one) while it has unsaved edits -- see that hook, which owns when this opens. */
export function DiscardChangesDialog({
  open,
  onConfirm,
  onCancel
}: DiscardChangesDialogProps): JSX.Element {
  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onCancel()}>
      <Dialog.Content className="max-w-sm" showClose={false}>
        <Dialog.Title>Unsaved changes</Dialog.Title>
        <Dialog.Description>
          This project has unsaved edits. Leaving now will discard them.
        </Dialog.Description>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            Discard changes
          </Button>
        </div>
      </Dialog.Content>
    </Dialog.Root>
  );
}
