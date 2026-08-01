import type React from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { Tooltip } from '@renderer/components/ui/Tooltip';

export const EditDeleteHeaderActions: React.FC = () => {
  return (
    <Tooltip.Provider delay={200} closeDelay={0}>
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
