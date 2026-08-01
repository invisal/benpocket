import type React from 'react';
import { Star, Pencil, Trash2 } from 'lucide-react';
import { Tooltip } from '@renderer/components/ui/Tooltip';
import { type IngressClassData } from '../../../types/IngressClassData';

interface IngressClassHeaderActionsProps {
  payload: IngressClassData;
}

export const IngressClassHeaderActions: React.FC<IngressClassHeaderActionsProps> = ({
  payload
}) => {
  const isDefault = Boolean(payload?.isDefault);

  return (
    <Tooltip.Provider delay={200} closeDelay={0}>
      <Tooltip.Root>
        <Tooltip.Trigger
          render={
            <button className="text-zinc-400 hover:text-yellow-400 cursor-pointer hover:bg-border-dark/40 p-1 rounded transition-colors border-none bg-transparent flex items-center justify-center">
              {isDefault ? (
                <Star className="size-3.5 fill-yellow-400 text-yellow-400" />
              ) : (
                <Star className="size-3.5" />
              )}
            </button>
          }
        />
        <Tooltip.Content side="bottom">
          {isDefault ? 'Remove default' : 'Set as default'}
        </Tooltip.Content>
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
