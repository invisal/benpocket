import { useState, type ReactNode } from 'react';
import { cn } from 'cnfast';
import { Dialog } from '../ui/Dialog';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useCloudflareSettings } from '@renderer/hooks/useCloudflareSettings';

interface ConnectCloudflareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm text-text-dim">{label}</span>
      {children}
    </label>
  );
}

function StatusBadge({ connected }: { connected: boolean }) {
  return (
    <span
      className={cn(
        'text-sm px-2 py-0.5 rounded-full',
        connected ? 'bg-emerald-500/15 text-emerald-400' : 'bg-surface-3 text-text-dim'
      )}
    >
      {connected ? 'Connected' : 'Not connected'}
    </span>
  );
}

export function ConnectCloudflareDialog({ open, onOpenChange }: ConnectCloudflareDialogProps) {
  const {
    isLoading,
    fields,
    configured,
    hasAccessKeys,
    gatewayConfigured,
    setFields,
    clearCloudflare,
    clearGateway
  } = useCloudflareSettings();

  const [isEditing, setIsEditing] = useState(false);
  const [accountId, setAccountId] = useState('');
  const [apiToken, setApiToken] = useState('');
  const [accessKeyId, setAccessKeyId] = useState('');
  const [secretAccessKey, setSecretAccessKey] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [gatewayId, setGatewayId] = useState('');
  const [gatewayError, setGatewayError] = useState<string | null>(null);

  // Resets the drafts to the saved values whenever the dialog opens (or the
  // initial snapshot finishes hydrating while it's already open) -- adjusted
  // during render rather than in an effect (react.dev-recommended way to
  // avoid the extra cascading render an effect-based reset would cause).
  // Doesn't depend on `fields` itself so a remote change synced in while the
  // dialog is open can't clobber an in-progress edit.
  const readyToShow = open && !isLoading;
  const [prevReadyToShow, setPrevReadyToShow] = useState(readyToShow);
  if (readyToShow !== prevReadyToShow) {
    setPrevReadyToShow(readyToShow);
    if (readyToShow) {
      setAccountId(configured ? fields.accountId : '');
      setApiToken('');
      setAccessKeyId('');
      setSecretAccessKey('');
      setError(null);
      setIsEditing(false);
      setGatewayId(fields.gatewayId);
      setGatewayError(null);
    }
  }

  const handleSave = () => {
    setError(null);
    const trimmedAccountId = accountId.trim();
    if (!trimmedAccountId) {
      setError('Account ID is required.');
      return;
    }

    // Editing an existing connection never pre-fills the real secret values,
    // so a blank secret field here means "keep what's already saved" rather
    // than "clear it" -- only Disconnect clears secrets.
    const resolvedApiToken = apiToken.trim() || fields.apiToken;
    if (!resolvedApiToken) {
      setError('API Token is required.');
      return;
    }
    const resolvedAccessKeyId = accessKeyId.trim() || fields.accessKeyId;
    const resolvedSecretAccessKey = secretAccessKey.trim() || fields.secretAccessKey;

    // R2 keys are optional together -- either both are set (R2 browsing works)
    // or both are blank (Cloudflare is still connected, just without R2).
    if (Boolean(resolvedAccessKeyId) !== Boolean(resolvedSecretAccessKey)) {
      setError('Provide both R2 access keys, or leave both blank.');
      return;
    }

    setFields({
      accountId: trimmedAccountId,
      apiToken: resolvedApiToken,
      accessKeyId: resolvedAccessKeyId,
      secretAccessKey: resolvedSecretAccessKey
    });
    setIsEditing(false);
    setApiToken('');
    setAccessKeyId('');
    setSecretAccessKey('');
  };

  const handleClear = () => {
    clearCloudflare();
    setIsEditing(false);
    setAccountId('');
  };

  const handleEdit = () => {
    setError(null);
    setApiToken('');
    setAccessKeyId('');
    setSecretAccessKey('');
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setError(null);
    setIsEditing(false);
  };

  const handleGatewaySave = () => {
    setGatewayError(null);
    const trimmedGatewayId = gatewayId.trim();
    if (!trimmedGatewayId) {
      setGatewayError('Gateway ID is required.');
      return;
    }
    setFields({ gatewayId: trimmedGatewayId });
  };

  const handleGatewayClear = () => {
    clearGateway();
    setGatewayId('');
  };

  const showCloudflareForm = !configured || isEditing;

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) setIsEditing(false);
    onOpenChange(nextOpen);
  };

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Content className="max-w-sm">
        <div className="flex items-center justify-between">
          <Dialog.Title>Connect Cloudflare</Dialog.Title>
          {!isLoading && (
            <div className="mr-6">
              <StatusBadge connected={configured} />
            </div>
          )}
        </div>
        <Dialog.Description>
          Account ID and API Token connect your Cloudflare account. R2 access keys are optional --
          add them later to browse R2 buckets from the file explorer.
        </Dialog.Description>

        <div className="mt-4">
          {isLoading ? null : configured && !isEditing ? (
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={handleEdit}>
                Edit
              </Button>
              <Button variant="destructive" size="sm" onClick={handleClear}>
                Disconnect
              </Button>
            </div>
          ) : showCloudflareForm ? (
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
                  placeholder={isEditing ? 'Leave blank to keep saved token' : undefined}
                />
              </Field>
              <Field label="R2 Access Key ID (optional)">
                <Input
                  size="sm"
                  value={accessKeyId}
                  onChange={(e) => setAccessKeyId(e.target.value)}
                  placeholder={
                    isEditing && hasAccessKeys ? 'Leave blank to keep saved key' : undefined
                  }
                />
              </Field>
              <Field label="R2 Secret Access Key (optional)">
                <Input
                  size="sm"
                  type="password"
                  value={secretAccessKey}
                  onChange={(e) => setSecretAccessKey(e.target.value)}
                  placeholder={
                    isEditing && hasAccessKeys ? 'Leave blank to keep saved key' : undefined
                  }
                />
              </Field>
              {error && <p className="text-sm text-red-400">{error}</p>}
              <div className="flex gap-2">
                <Button variant="primary" size="sm" onClick={handleSave}>
                  Save
                </Button>
                {isEditing && (
                  <Button variant="secondary" size="sm" onClick={handleCancelEdit}>
                    Cancel
                  </Button>
                )}
              </div>
            </div>
          ) : null}
        </div>

        {configured && (
          <div className="mt-5 border-t border-border pt-4">
            <div className="flex items-center justify-between">
              <span className="font-medium text-text-base">AI Gateway</span>
              <StatusBadge connected={gatewayConfigured} />
            </div>
            <p className="mt-1 text-sm text-text-dim">
              Lets the file explorer&apos;s AI agent chat through your Cloudflare AI Gateway.
            </p>
            <div className="mt-3 flex flex-col gap-3">
              <Field label="Gateway ID">
                <Input size="sm" value={gatewayId} onChange={(e) => setGatewayId(e.target.value)} />
              </Field>
              {gatewayError && <p className="text-sm text-red-400">{gatewayError}</p>}
              <div className="flex gap-2">
                <Button variant="primary" size="sm" onClick={handleGatewaySave}>
                  Save
                </Button>
                {gatewayConfigured && (
                  <Button variant="destructive" size="sm" onClick={handleGatewayClear}>
                    Disconnect
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </Dialog.Content>
    </Dialog.Root>
  );
}
