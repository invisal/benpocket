import type React from 'react';
import { useState } from 'react';
import { Pencil, Trash2, Terminal, FileText, Share2, Box } from 'lucide-react';
import { Tooltip } from '@renderer/components/ui/Tooltip';
import { Popover } from '@renderer/components/ui/Popover';
import { useKuberneterStore } from '../../../../store/kuberneter.store';
import { type PodData } from '../../../../types/PodData';

interface PodHeaderActionsProps {
  payload: PodData;
}

interface ContainerActionMenuProps {
  containers: Array<{ name: string }>;
  icon: React.ComponentType<{ className?: string }>;
  tooltipText: string;
  onSelect: (containerName?: string) => void;
  showAllContainersOption?: boolean;
}

const ContainerActionMenu: React.FC<ContainerActionMenuProps> = ({
  containers,
  icon: Icon,
  tooltipText,
  onSelect,
  showAllContainersOption = false
}) => {
  const [open, setOpen] = useState(false);

  if (containers.length <= 1) {
    return (
      <Tooltip.Root>
        <Tooltip.Trigger
          render={
            <button
              onClick={() => onSelect(containers[0]?.name)}
              className="text-zinc-400 hover:text-white cursor-pointer hover:bg-border-dark/40 p-1 rounded transition-colors border-none bg-transparent flex items-center justify-center"
            >
              <Icon className="size-3.5" />
            </button>
          }
        />
        <Tooltip.Content side="bottom">{tooltipText}</Tooltip.Content>
      </Tooltip.Root>
    );
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Tooltip.Root>
        <Tooltip.Trigger
          render={
            <Popover.Trigger
              render={
                <button className="text-zinc-400 hover:text-white cursor-pointer hover:bg-border-dark/40 p-1 rounded transition-colors border-none bg-transparent flex items-center justify-center">
                  <Icon className="size-3.5" />
                </button>
              }
            />
          }
        />
        <Tooltip.Content side="bottom">{tooltipText}</Tooltip.Content>
      </Tooltip.Root>

      <Popover.Content
        side="bottom"
        align="end"
        className="p-1.5 min-w-[140px] bg-surface-2 border border-border-dark shadow-xl rounded-md z-50"
      >
        <div className="px-2 py-1 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider border-b border-border-dark/50 mb-1">
          Select Container
        </div>
        <div className="flex flex-col gap-0.5 max-h-48 overflow-y-auto">
          {showAllContainersOption && (
            <button
              onClick={() => {
                onSelect(undefined);
                setOpen(false);
              }}
              className="flex items-center gap-2 px-2 py-1.5 text-xs text-zinc-300 hover:text-white hover:bg-accent/20 rounded transition-colors text-left border-none bg-transparent cursor-pointer font-mono"
            >
              <Box className="size-3 text-accent shrink-0" />
              <span className="truncate">All containers</span>
            </button>
          )}
          {containers.map((c) => (
            <button
              key={c.name}
              onClick={() => {
                onSelect(c.name);
                setOpen(false);
              }}
              className="flex items-center gap-2 px-2 py-1.5 text-xs text-zinc-300 hover:text-white hover:bg-accent/20 rounded transition-colors text-left border-none bg-transparent cursor-pointer font-mono"
            >
              <Box className="size-3 text-zinc-400 shrink-0" />
              <span className="truncate">{c.name}</span>
            </button>
          ))}
        </div>
      </Popover.Content>
    </Popover.Root>
  );
};

export const PodHeaderActions: React.FC<PodHeaderActionsProps> = ({ payload }) => {
  const name = payload?.name || payload?.rawItem?.metadata?.name || '';
  const ns = payload?.ns || payload?.rawItem?.metadata?.namespace || '';
  const rawSpec = (payload?.rawItem as Record<string, unknown> | undefined)?.spec as
    { containers?: Array<{ name: string }> } | undefined;
  const containers: Array<{ name: string }> = payload?.containers || rawSpec?.containers || [];

  const handleTerminal = (containerName?: string) => {
    if (name) {
      useKuberneterStore.getState().openPodTerminalTab(name, ns, containerName);
    }
  };

  const handleLogs = (containerName?: string) => {
    if (name) {
      useKuberneterStore.getState().openPodLogsTab(name, ns, containerName);
    }
  };

  return (
    <Tooltip.Provider delay={200} closeDelay={0}>
      <ContainerActionMenu
        containers={containers}
        icon={Terminal}
        tooltipText="Pod Terminal"
        onSelect={handleTerminal}
      />

      <ContainerActionMenu
        containers={containers}
        icon={FileText}
        tooltipText="Pod Logs"
        onSelect={handleLogs}
        showAllContainersOption
      />

      <Tooltip.Root>
        <Tooltip.Trigger
          render={
            <button className="text-zinc-400 hover:text-white cursor-pointer hover:bg-border-dark/40 p-1 rounded transition-colors border-none bg-transparent flex items-center justify-center">
              <Share2 className="size-3.5" />
            </button>
          }
        />
        <Tooltip.Content side="bottom">Attach / Share</Tooltip.Content>
      </Tooltip.Root>

      <Tooltip.Root>
        <Tooltip.Trigger
          render={
            <button className="text-zinc-400 hover:text-white cursor-pointer hover:bg-border-dark/40 p-1 rounded transition-colors border-none bg-transparent flex items-center justify-center">
              <Pencil className="size-3.5" />
            </button>
          }
        />
        <Tooltip.Content side="bottom">Edit</Tooltip.Content>
      </Tooltip.Root>

      <Tooltip.Root>
        <Tooltip.Trigger
          render={
            <button className="text-zinc-400 hover:text-red-400 cursor-pointer hover:bg-border-dark/40 p-1 rounded transition-colors border-none bg-transparent flex items-center justify-center">
              <Trash2 className="size-3.5" />
            </button>
          }
        />
        <Tooltip.Content side="bottom">Delete</Tooltip.Content>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
};
