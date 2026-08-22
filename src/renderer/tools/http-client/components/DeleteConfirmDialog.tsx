import type React from 'react';
import { Dialog } from '@renderer/components/ui/Dialog';
import { Button } from '@renderer/components/ui/Button';

interface DeleteConfirmTarget {
  kind: string;
  name: string;
  /** What else gets deleted along with it, e.g. "3 requests" or "2 collections and 1 environment" - omitted if nothing else is affected. */
  cascade?: string;
}

interface DeleteConfirmDialogProps {
  /** `null` when nothing is pending deletion - keeps the dialog closed. */
  target: DeleteConfirmTarget | null;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Guards a cascading, irreversible delete (collection/folder/workspace) behind an explicit confirmation. */
export const DeleteConfirmDialog: React.FC<DeleteConfirmDialogProps> = ({
  target,
  onConfirm,
  onCancel
}) => {
  return (
    <Dialog.Root open={target !== null} onOpenChange={(next) => !next && onCancel()}>
      <Dialog.Content className="max-w-sm" showClose={false}>
        {target && (
          <>
            <Dialog.Title>Delete {target.kind}?</Dialog.Title>
            <Dialog.Description>
              {`"${target.name}" will be permanently deleted`}
              {target.cascade ? `, along with ${target.cascade}` : ''}. This can&apos;t be undone.
            </Dialog.Description>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="secondary" onClick={onCancel}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={onConfirm}>
                Delete
              </Button>
            </div>
          </>
        )}
      </Dialog.Content>
    </Dialog.Root>
  );
};
