import type React from 'react';
import { Pencil, Trash2, Terminal, Pause, RefreshCw } from 'lucide-react';
import { Tooltip } from '@renderer/components/ui/Tooltip';
import { useKuberneterStore } from '../../../store/kuberneter.store';
import { type NodeData } from '../../../types/NodeData';

interface NodeHeaderActionsProps {
  payload: NodeData;
}

export const NodeHeaderActions: React.FC<NodeHeaderActionsProps> = ({ payload }) => {
  const name = payload?.name || '';

  const handleShell = () => {
    if (name) {
      useKuberneterStore.getState().openNodeTerminalTab(name);
    }
  };

  return (
    <Tooltip.Provider delay={200} closeDelay={0}>
      <Tooltip.Root>
        <Tooltip.Trigger
          render={
            <button
              onClick={handleShell}
              className="text-zinc-400 hover:text-white cursor-pointer hover:bg-border-dark/40 p-1 rounded transition-colors border-none bg-transparent flex items-center justify-center"
            >
              <Terminal className="size-3.5" />
            </button>
          }
        />
        <Tooltip.Content side="bottom">Node Shell</Tooltip.Content>
      </Tooltip.Root>

      <Tooltip.Root>
        <Tooltip.Trigger
          render={
            <button className="text-zinc-400 hover:text-white cursor-pointer hover:bg-border-dark/40 p-1 rounded transition-colors border-none bg-transparent flex items-center justify-center">
              <Pause className="size-3.5" />
            </button>
          }
        />
        <Tooltip.Content side="bottom">Cordon Node</Tooltip.Content>
      </Tooltip.Root>

      <Tooltip.Root>
        <Tooltip.Trigger
          render={
            <button className="text-zinc-400 hover:text-white cursor-pointer hover:bg-border-dark/40 p-1 rounded transition-colors border-none bg-transparent flex items-center justify-center">
              <RefreshCw className="size-3.5" />
            </button>
          }
        />
        <Tooltip.Content side="bottom">Refresh</Tooltip.Content>
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
