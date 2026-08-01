import type React from 'react';
import { Pencil, Trash2, Terminal, FileText, Share2 } from 'lucide-react';
import { Tooltip } from '@renderer/components/ui/Tooltip';
import { useKuberneterStore } from '../../../../store/kuberneter.store';
import { type PodData } from '../../../../types/PodData';

interface PodHeaderActionsProps {
  payload: PodData;
}

export const PodHeaderActions: React.FC<PodHeaderActionsProps> = ({ payload }) => {
  const name = payload?.name || payload?.rawItem?.metadata?.name || '';
  const ns = payload?.ns || payload?.rawItem?.metadata?.namespace || '';

  const handleTerminal = () => {
    if (name) {
      useKuberneterStore.getState().openPodTerminalTab(name, ns);
    }
  };

  return (
    <Tooltip.Provider delay={200} closeDelay={0}>
      <Tooltip.Root>
        <Tooltip.Trigger
          render={
            <button
              onClick={handleTerminal}
              className="text-zinc-400 hover:text-white cursor-pointer hover:bg-border-dark/40 p-1 rounded transition-colors border-none bg-transparent flex items-center justify-center"
            >
              <Terminal className="size-3.5" />
            </button>
          }
        />
        <Tooltip.Content side="bottom">Pod Terminal</Tooltip.Content>
      </Tooltip.Root>

      <Tooltip.Root>
        <Tooltip.Trigger
          render={
            <button className="text-zinc-400 hover:text-white cursor-pointer hover:bg-border-dark/40 p-1 rounded transition-colors border-none bg-transparent flex items-center justify-center">
              <FileText className="size-3.5" />
            </button>
          }
        />
        <Tooltip.Content side="bottom">Pod Logs</Tooltip.Content>
      </Tooltip.Root>

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
