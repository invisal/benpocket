import { useEffect, useState, type ReactNode } from 'react';
import { Dialog } from '@renderer/components/ui/Dialog';
import { Button } from '@renderer/components/ui/Button';
import { Input } from '@renderer/components/ui/Input';
import { Select } from '@renderer/components/ui/Select';
import { AGENT_MODELS } from '../lib/models';

type Status = 'loading' | 'configured' | 'empty' | 'no-cloudflare';

interface ConnectAiGatewayDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConnected?: () => void;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

export function ConnectAiGatewayDialog({
  open,
  onOpenChange,
  onConnected
}: ConnectAiGatewayDialogProps) {
  const [status, setStatus] = useState<Status>('loading');
  const [gatewayId, setGatewayId] = useState('');
  const [model, setModel] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    window.fileExplorer.getAiGatewayCredentialStatus().then((res) => {
      if (!res.cloudflareConnected) {
        setStatus('no-cloudflare');
        return;
      }
      setStatus(res.configured ? 'configured' : 'empty');
      setGatewayId(res.gatewayId);
      setModel(res.model || (AGENT_MODELS[0]?.id ?? ''));
    });
  }, [open]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    const result = await window.fileExplorer.setAiGatewayCredential(gatewayId.trim(), model.trim());
    setSaving(false);
    if ('error' in result) {
      setError(result.error);
      return;
    }
    setStatus('configured');
    onConnected?.();
  };

  const handleClear = async () => {
    setSaving(true);
    await window.fileExplorer.clearAiGatewayCredential();
    setSaving(false);
    setStatus('empty');
    setGatewayId('');
    setModel('');
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content className="max-w-sm">
        <div className="flex items-center justify-between">
          <Dialog.Title>Connect AI Gateway</Dialog.Title>
          {status === 'configured' && (
            <span className="text-xs px-2 py-0.5 rounded-full mr-6 bg-emerald-500/15 text-emerald-400">
              Connected
            </span>
          )}
          {status === 'empty' && (
            <span className="text-xs px-2 py-0.5 rounded-full mr-6 bg-surface-3 text-muted-foreground">
              Not connected
            </span>
          )}
        </div>
        <Dialog.Description>
          Uses your Cloudflare AI Gateway&apos;s unified endpoint, under the Cloudflare account
          you&apos;ve already connected. Provider API keys (OpenAI, Anthropic, etc.) should already
          be configured as BYOK on the gateway itself.
        </Dialog.Description>

        <div className="mt-4">
          {status === 'no-cloudflare' && (
            <p className="text-xs text-muted-foreground">
              Connect Cloudflare (Account ID + API Token) from the Home tab first, then come back
              here to link a gateway.
            </p>
          )}
          {(status === 'configured' || status === 'empty') && (
            <div className="flex flex-col gap-3">
              <Field label="Gateway ID">
                <Input size="sm" value={gatewayId} onChange={(e) => setGatewayId(e.target.value)} />
              </Field>
              <Field label="Model">
                <Select.Root value={model} onValueChange={(value) => setModel(value as string)}>
                  <Select.Trigger size="sm">
                    <Select.Value />
                  </Select.Trigger>
                  <Select.Content side="bottom" align="start">
                    {AGENT_MODELS.map((option) => (
                      <Select.Item key={option.id} value={option.id}>
                        <Select.ItemText>{option.label}</Select.ItemText>
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select.Root>
              </Field>
              {error && <p className="text-xs text-red-400">{error}</p>}
              <div className="flex gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => void handleSave()}
                  disabled={saving}
                >
                  {saving ? 'Saving…' : 'Save'}
                </Button>
                {status === 'configured' && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => void handleClear()}
                    disabled={saving}
                  >
                    {saving ? 'Clearing…' : 'Disconnect'}
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </Dialog.Content>
    </Dialog.Root>
  );
}
