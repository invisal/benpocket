import type React from 'react';
import { useState } from 'react';
import { Dialog } from '@renderer/components/ui/Dialog';
import { Button } from '@renderer/components/ui/Button';
import type { HttpAuth } from '../../../../preload/http-client/types';
import { DEFAULT_HTTP_AUTH } from '../lib/auth';
import { AuthEditor } from './AuthEditor';

interface AuthorizationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  auth: HttpAuth | undefined;
  onSave: (auth: HttpAuth) => Promise<void>;
}

/** Sets the auth requests inherit by default when saved into this collection/folder. */
export const AuthorizationDialog: React.FC<AuthorizationDialogProps> = ({
  open,
  onOpenChange,
  title,
  auth: savedAuth,
  onSave
}) => {
  const [auth, setAuth] = useState<HttpAuth>(savedAuth ?? DEFAULT_HTTP_AUTH);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset the draft to the saved auth each time the dialog opens - adjusted directly
  // during render (rather than in an effect) so it applies before paint, mirroring the
  // tab-reveal pattern in HttpClientSidebar.tsx.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setAuth(savedAuth ?? DEFAULT_HTTP_AUTH);
      setError(null);
    }
  }

  const handleSave = async (): Promise<void> => {
    setSaving(true);
    setError(null);
    try {
      await onSave(auth);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content className="max-w-sm">
        <Dialog.Title>{title}</Dialog.Title>
        <Dialog.Description>
          Requests inside inherit this unless they set their own authorization.
        </Dialog.Description>
        <div className="mt-4">
          <AuthEditor auth={auth} onChange={setAuth} />
        </div>
        {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
        <div className="mt-4 flex gap-2">
          <Button variant="primary" size="sm" onClick={() => void handleSave()} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </Dialog.Content>
    </Dialog.Root>
  );
};
