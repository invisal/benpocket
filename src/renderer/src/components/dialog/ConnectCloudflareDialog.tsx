import { useEffect, useState, type ReactNode } from 'react';
import { cn } from 'cnfast';
import { Dialog } from '../ui/Dialog';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

type Status = 'loading' | 'configured' | 'empty';

interface ConnectCloudflareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-text-dim">{label}</span>
      {children}
    </label>
  );
}

export function ConnectCloudflareDialog({ open, onOpenChange }: ConnectCloudflareDialogProps) {
  const [status, setStatus] = useState<Status>('loading');
  const [accountId, setAccountId] = useState('');
  const [apiToken, setApiToken] = useState('');
  const [accessKeyId, setAccessKeyId] = useState('');
  const [secretAccessKey, setSecretAccessKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    window.fileExplorer.getR2CredentialStatus().then((res) => {
      setStatus(res.configured ? 'configured' : 'empty');
    });
  }, [open]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    const result = await window.fileExplorer.setR2Credential(
      accountId.trim(),
      apiToken.trim(),
      accessKeyId.trim(),
      secretAccessKey.trim()
    );
    setSaving(false);
    if ('error' in result) {
      setError(result.error);
      return;
    }
    setStatus('configured');
    setAccountId('');
    setApiToken('');
    setAccessKeyId('');
    setSecretAccessKey('');
  };

  const handleClear = async () => {
    setSaving(true);
    await window.fileExplorer.clearR2Credential();
    setSaving(false);
    setStatus('empty');
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content className="max-w-sm">
        <div className="flex items-center justify-between">
          <Dialog.Title>Connect Cloudflare</Dialog.Title>
          {status !== 'loading' && (
            <span
              className={cn(
                'text-xs px-2 py-0.5 rounded-full mr-6',
                status === 'configured'
                  ? 'bg-emerald-500/15 text-emerald-400'
                  : 'bg-surface-3 text-text-dim'
              )}
            >
              {status === 'configured' ? 'Connected' : 'Not connected'}
            </span>
          )}
        </div>
        <Dialog.Description>
          Lets benpocket browse the R2 buckets this token can see. All four fields are required
          together.
        </Dialog.Description>

        <div className="mt-4">
          {status === 'configured' ? (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => void handleClear()}
              disabled={saving}
            >
              {saving ? 'Clearing…' : 'Disconnect'}
            </Button>
          ) : status === 'empty' ? (
            <div className="flex flex-col gap-3">
              <Field label="Cloudflare Account ID">
                <Input size="sm" value={accountId} onChange={(e) => setAccountId(e.target.value)} />
              </Field>
              <Field label="API Token">
                <Input
                  size="sm"
                  type="password"
                  value={apiToken}
                  onChange={(e) => setApiToken(e.target.value)}
                />
              </Field>
              <Field label="R2 Access Key ID">
                <Input
                  size="sm"
                  value={accessKeyId}
                  onChange={(e) => setAccessKeyId(e.target.value)}
                />
              </Field>
              <Field label="R2 Secret Access Key">
                <Input
                  size="sm"
                  type="password"
                  value={secretAccessKey}
                  onChange={(e) => setSecretAccessKey(e.target.value)}
                />
              </Field>
              {error && <p className="text-xs text-red-400">{error}</p>}
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
          ) : null}
        </div>
      </Dialog.Content>
    </Dialog.Root>
  );
}
