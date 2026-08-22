import { useState, type ReactNode } from 'react';
import { cn } from 'cnfast';
import { Dialog } from '@renderer/components/ui/Dialog';
import { Button } from '@renderer/components/ui/Button';
import { Input } from '@renderer/components/ui/Input';
import { useCloudflareSettings } from '@renderer/hooks/useCloudflareSettings';
import { AGENT_MODELS } from '../lib/models';

interface ConnectAiGatewayDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

export function ConnectAiGatewayDialog({ open, onOpenChange }: ConnectAiGatewayDialogProps) {
  const { isLoading, fields, configured, gatewayConfigured, setFields, clearGateway } =
    useCloudflareSettings();
  const [gatewayId, setGatewayId] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Resets the draft to the saved value whenever the dialog opens (or the
  // initial snapshot finishes hydrating while it's already open) -- adjusted
  // during render rather than in an effect, same as ConnectCloudflareDialog.
  const readyToShow = open && !isLoading;
  const [prevReadyToShow, setPrevReadyToShow] = useState(readyToShow);
  if (readyToShow !== prevReadyToShow) {
    setPrevReadyToShow(readyToShow);
    if (readyToShow) {
      setGatewayId(fields.gatewayId);
      setError(null);
    }
  }

  const handleSave = () => {
    setError(null);
    const trimmedGatewayId = gatewayId.trim();
    if (!trimmedGatewayId) {
      setError('Gateway ID is required.');
      return;
    }
    // No model field in this dialog -- it's picked from the ChatInput toolbar
    // instead. Falls back to the first model on first connect, before any
    // model has been chosen from the chat.
    setFields({ gatewayId: trimmedGatewayId, model: fields.model || (AGENT_MODELS[0]?.id ?? '') });
  };

  const handleClear = () => {
    clearGateway();
    setGatewayId('');
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content className="max-w-sm">
        <div className="flex items-center justify-between">
          <Dialog.Title>Connect AI Gateway</Dialog.Title>
          {!isLoading && configured && (
            <span
              className={cn(
                'text-sm px-2 py-0.5 rounded-full mr-6',
                gatewayConfigured
                  ? 'bg-emerald-500/15 text-emerald-400'
                  : 'bg-surface-3 text-muted-foreground'
              )}
            >
              {gatewayConfigured ? 'Connected' : 'Not connected'}
            </span>
          )}
        </div>
        <Dialog.Description>
          Uses your Cloudflare AI Gateway&apos;s unified endpoint, under the Cloudflare account
          you&apos;ve already connected. Provider API keys (OpenAI, Anthropic, etc.) should already
          be configured as BYOK on the gateway itself.
        </Dialog.Description>

        <div className="mt-4">
          {!isLoading && !configured && (
            <p className="text-sm text-muted-foreground">
              Connect Cloudflare (Account ID + API Token) from the Home tab first, then come back
              here to link a gateway.
            </p>
          )}
          {!isLoading && configured && (
            <div className="flex flex-col gap-3">
              <Field label="Gateway ID">
                <Input size="sm" value={gatewayId} onChange={(e) => setGatewayId(e.target.value)} />
              </Field>
              {error && <p className="text-sm text-red-400">{error}</p>}
              <div className="flex gap-2">
                <Button variant="primary" size="sm" onClick={handleSave}>
                  Save
                </Button>
                {gatewayConfigured && (
                  <Button variant="destructive" size="sm" onClick={handleClear}>
                    Disconnect
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
