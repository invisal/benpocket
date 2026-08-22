import type React from 'react';
import { useState } from 'react';
import { Dialog } from '@renderer/components/ui/Dialog';
import { Button } from '@renderer/components/ui/Button';
import { Globe, Laptop, Cloud } from 'lucide-react';
import { cn } from 'cnfast';
import type { PortForwardTunnelType } from '../../../types/PortForwardData';

interface PortForwardDialogProps {
  isOpen: boolean;
  onClose: () => void;
  podName?: string;
  resourceName?: string;
  namespace: string;
  containerPort: number;
  onStart: (params: {
    localPort: number;
    openBrowser: boolean;
    tunnelType: PortForwardTunnelType;
  }) => void;
}

export const PortForwardDialog: React.FC<PortForwardDialogProps> = ({
  isOpen,
  onClose,
  podName,
  resourceName,
  containerPort,
  onStart
}) => {
  const [localPortInput, setLocalPortInput] = useState('');
  const [openBrowser, setOpenBrowser] = useState(true);
  const [tunnelType, setTunnelType] = useState<PortForwardTunnelType>('none');

  const handleStart = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseInt(localPortInput, 10);
    const targetPort =
      !isNaN(parsed) && parsed > 0 && parsed <= 65535
        ? parsed
        : Math.floor(Math.random() * (65000 - 50000 + 1)) + 50000;

    onStart({
      localPort: targetPort,
      openBrowser,
      tunnelType
    });
    onClose();
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Content className="max-w-md p-0 overflow-hidden bg-surface border border-border-dark rounded-lg shadow-xl">
        <form onSubmit={handleStart}>
          {/* Dialog Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border-dark">
            <Dialog.Title className="text-sm font-semibold text-foreground truncate max-w-[340px]">
              Port Forwarding for {resourceName || podName}
            </Dialog.Title>
          </div>

          {/* Dialog Body */}
          <div className="flex flex-col gap-4 p-5 text-sm text-foreground">
            {/* Target Selection */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">Exposure Target</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setTunnelType('none')}
                  className={cn(
                    'flex flex-col items-center justify-center p-2.5 rounded-lg border text-center transition-all cursor-pointer select-none gap-1.5',
                    tunnelType === 'none'
                      ? 'bg-surface-3 border-accent text-accent ring-1 ring-accent'
                      : 'bg-surface-2 border-border/60 text-muted-foreground hover:bg-surface-3 hover:text-foreground'
                  )}
                >
                  <Laptop className="size-4" />
                  <span className="text-[11px] font-medium leading-tight">Localhost</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTunnelType('cloudflare')}
                  className={cn(
                    'flex flex-col items-center justify-center p-2.5 rounded-lg border text-center transition-all cursor-pointer select-none gap-1.5',
                    tunnelType === 'cloudflare'
                      ? 'bg-surface-3 border-accent text-accent ring-1 ring-accent'
                      : 'bg-surface-2 border-border/60 text-muted-foreground hover:bg-surface-3 hover:text-foreground'
                  )}
                >
                  <Cloud className="size-4" />
                  <span className="text-[11px] font-medium leading-tight">Cloudflare</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTunnelType('ngrok')}
                  className={cn(
                    'flex flex-col items-center justify-center p-2.5 rounded-lg border text-center transition-all cursor-pointer select-none gap-1.5',
                    tunnelType === 'ngrok'
                      ? 'bg-surface-3 border-accent text-accent ring-1 ring-accent'
                      : 'bg-surface-2 border-border/60 text-muted-foreground hover:bg-surface-3 hover:text-foreground'
                  )}
                >
                  <Globe className="size-4" />
                  <span className="text-[11px] font-medium leading-tight">ngrok</span>
                </button>
              </div>

              <div className="text-[11px] text-muted-foreground bg-surface-2/60 p-2 rounded border border-border/40 mt-1">
                {tunnelType === 'none' && (
                  <span>
                    Binds cluster port <strong>{containerPort}</strong> locally to{' '}
                    <code className="text-foreground">127.0.0.1</code> on your machine.
                  </span>
                )}
                {tunnelType === 'cloudflare' && (
                  <span>
                    Creates a <strong>free public HTTPS URL</strong> (
                    <code className="text-foreground">*.trycloudflare.com</code>) via Cloudflare
                    Quick Tunnel. No login or account required.
                  </span>
                )}
                {tunnelType === 'ngrok' && (
                  <span>
                    Creates a <strong>public HTTPS URL</strong> (
                    <code className="text-foreground">*.ngrok-free.app</code>) using your local
                    ngrok configuration.
                  </span>
                )}
              </div>
            </div>

            {/* Local Port Input */}
            <div className="flex items-center gap-2 pt-1">
              <label
                htmlFor="local-port-input"
                className="text-sm text-foreground whitespace-nowrap"
              >
                Local port to forward from:
              </label>
              <input
                id="local-port-input"
                type="text"
                value={localPortInput}
                onChange={(e) => setLocalPortInput(e.target.value)}
                placeholder="Random"
                className="flex-1 bg-transparent border-b border-accent focus:border-accent outline-none text-sm font-mono px-1 py-0.5 text-foreground placeholder:text-muted-foreground/60"
                autoFocus
              />
            </div>

            {/* Checkboxes */}
            <div className="flex flex-col gap-2 pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={openBrowser}
                  onChange={(e) => setOpenBrowser(e.target.checked)}
                  className="size-3.5 rounded border border-border-dark accent-accent bg-surface-3 cursor-pointer"
                />
                <span>Open in Browser when ready</span>
              </label>
            </div>
          </div>

          {/* Dialog Footer */}
          <div className="flex items-center justify-between px-4 py-3 bg-surface-2/40 border-t border-border-dark">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onClose}
              className="px-4 text-sm font-medium"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              className="px-5 text-sm font-medium bg-sky-600 hover:bg-sky-500 text-white"
            >
              Start Forwarding
            </Button>
          </div>
        </form>
      </Dialog.Content>
    </Dialog.Root>
  );
};
