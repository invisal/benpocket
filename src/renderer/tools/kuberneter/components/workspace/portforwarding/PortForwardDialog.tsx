import type React from 'react';
import { useState } from 'react';
import { Dialog } from '@renderer/components/ui/Dialog';
import { Button } from '@renderer/components/ui/Button';

interface PortForwardDialogProps {
  isOpen: boolean;
  onClose: () => void;
  podName: string;
  namespace: string;
  containerPort: number;
  initialProtocol?: string;
  onStart: (localPort: number, isHttps: boolean, openBrowser: boolean) => void;
}

export const PortForwardDialog: React.FC<PortForwardDialogProps> = ({
  isOpen,
  onClose,
  podName,
  initialProtocol,
  onStart
}) => {
  const [localPortInput, setLocalPortInput] = useState('');
  const [isHttps, setIsHttps] = useState(initialProtocol?.toLowerCase() === 'https');
  const [openBrowser, setOpenBrowser] = useState(true);

  const handleStart = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseInt(localPortInput, 10);
    const targetPort =
      !isNaN(parsed) && parsed > 0 && parsed <= 65535
        ? parsed
        : Math.floor(Math.random() * (65000 - 50000 + 1)) + 50000;

    onStart(targetPort, isHttps, openBrowser);
    onClose();
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Content className="max-w-md p-0 overflow-hidden bg-surface border border-border-dark rounded-lg shadow-xl">
        <form onSubmit={handleStart}>
          {/* Dialog Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border-dark">
            <Dialog.Title className="text-xs font-semibold text-text-base truncate max-w-[340px]">
              Port Forwarding for {podName}
            </Dialog.Title>
          </div>

          {/* Dialog Body */}
          <div className="flex flex-col gap-4 p-5 text-xs text-text-base">
            <div className="flex items-center gap-2">
              <label
                htmlFor="local-port-input"
                className="text-xs text-text-base whitespace-nowrap"
              >
                Local port to forward from:
              </label>
              <input
                id="local-port-input"
                type="text"
                value={localPortInput}
                onChange={(e) => setLocalPortInput(e.target.value)}
                placeholder="Random"
                className="flex-1 bg-transparent border-b border-accent focus:border-accent outline-none text-xs font-mono px-1 py-0.5 text-text-base placeholder:text-text-dim/60"
                autoFocus
              />
            </div>

            <div className="flex flex-col gap-2 pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-text-base">
                <input
                  type="checkbox"
                  checked={isHttps}
                  onChange={(e) => setIsHttps(e.target.checked)}
                  className="size-3.5 rounded border border-border-dark accent-accent bg-surface-3 cursor-pointer"
                />
                <span>https</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-text-base">
                <input
                  type="checkbox"
                  checked={openBrowser}
                  onChange={(e) => setOpenBrowser(e.target.checked)}
                  className="size-3.5 rounded border border-border-dark accent-accent bg-surface-3 cursor-pointer"
                />
                <span>Open in Browser</span>
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
              className="px-4 text-xs font-medium"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              className="px-5 text-xs font-medium bg-sky-600 hover:bg-sky-500 text-white"
            >
              Start
            </Button>
          </div>
        </form>
      </Dialog.Content>
    </Dialog.Root>
  );
};
