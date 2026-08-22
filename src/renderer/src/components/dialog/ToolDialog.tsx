import type { ReactNode } from 'react';
import { CameraIcon, Folder, GlobeIcon, VideoIcon, SwatchBookIcon } from 'lucide-react';
import { cn } from 'cnfast';
import { Dialog } from '../ui/Dialog';
import { useToolTabs } from '../providers/ToolProvider';
import { useLayoutStore } from '../../store/layout.store';
import kuberneterIcon from '@renderer/assets/kuberneter-icon.svg';

interface ToolDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ToolDialog({ open, onOpenChange }: ToolDialogProps) {
  const { openTab } = useToolTabs();

  const close = () => onOpenChange(false);

  const handleOpenKuberneter = () => {
    const instanceId = `kuberneter-${Date.now()}`;
    if (openTab('kuberneter', { instanceId }) === null) return;
    useLayoutStore.getState().addActivityInstance('kuberneter', instanceId);
    close();
  };

  const handleOpenHttpClient = () => {
    if (openTab('http-client', {}) !== null) close();
  };

  const handleOpenScreenRecorder = () => {
    if (openTab('screen-recorder', {}) !== null) close();
  };

  const handleOpenScreenCapture = () => {
    if (openTab('screen-capture', {}) !== null) close();
  };

  const handleOpenFileExplorer = () => {
    if (openTab('file-explorer', {}) !== null) close();
  };

  const handleOpenStorybook = () => {
    if (openTab('storybook', {}) !== null) close();
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content className="max-w-sm">
        <Dialog.Title>Add Tool</Dialog.Title>
        <Dialog.Description>Choose a tool to open.</Dialog.Description>
        <div className="mt-4 space-y-1">
          <ToolRow
            icon={<Folder size={18} />}
            name="File Explorer"
            description="Browse files on your computer."
            onClick={handleOpenFileExplorer}
          />
          <ToolRow
            icon={<img src={kuberneterIcon} className="size-5" alt="Kubernetes" />}
            name="Kubernetes"
            description="Connect to a cluster and manage workloads."
            onClick={handleOpenKuberneter}
          />
          <ToolRow
            icon={<GlobeIcon size={18} />}
            name="HTTP Client"
            description="Compose and send API requests."
            onClick={handleOpenHttpClient}
          />
          <ToolRow
            icon={<VideoIcon size={18} />}
            name="Screen Recorder"
            description="Record and export your screen."
            onClick={handleOpenScreenRecorder}
          />
          <ToolRow
            icon={<CameraIcon size={18} />}
            name="Screen Capture"
            description="Capture a still image from your screen."
            onClick={handleOpenScreenCapture}
          />
          {import.meta.env.DEV && (
            <ToolRow
              icon={<SwatchBookIcon size={18} />}
              name="Storybook"
              description="Browse shared UI components and mockup pages."
              onClick={handleOpenStorybook}
            />
          )}
        </div>
      </Dialog.Content>
    </Dialog.Root>
  );
}

function ToolRow({
  icon,
  name,
  description,
  onClick
}: {
  icon: ReactNode;
  name: string;
  description?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex w-full cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-left outline-none',
        'hover:bg-border-dark/60'
      )}
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-surface-2">
        {icon}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-[13px] font-medium text-text-base">{name}</span>
        {description && <span className="truncate text-xs text-text-dim">{description}</span>}
      </span>
    </button>
  );
}
