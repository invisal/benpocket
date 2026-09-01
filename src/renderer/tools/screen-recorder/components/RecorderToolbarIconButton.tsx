import type { ReactNode } from 'react';
import { cn } from 'cnfast';
import { Tooltip } from '@renderer/components/ui/Tooltip';
import { NO_DRAG } from '../lib/pointer-events';

const SIZE_CLASSES = { 7: 'h-7 w-7', 8: 'h-8 w-8' } as const;

const TONE_CLASSES = {
  plain: 'text-muted-foreground hover:bg-surface-3 hover:text-foreground',
  default: 'bg-surface-3 text-muted-foreground hover:bg-surface-4 hover:text-foreground',
  danger: 'bg-red-500/20 text-red-400'
} as const;

/** The circular icon-button-in-a-tooltip shape repeated across the toolbar pill (Close, Stop, Pause/Resume, Restart, Delete). */
export function RecorderToolbarIconButton({
  icon,
  tooltip,
  onClick,
  disabled,
  tone = 'default',
  size = 8
}: {
  icon: ReactNode;
  tooltip: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  tone?: 'plain' | 'default' | 'danger';
  size?: 7 | 8;
}): ReactNode {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger
        onClick={onClick}
        disabled={disabled}
        className={cn(
          NO_DRAG,
          'flex items-center justify-center rounded-full disabled:opacity-50',
          SIZE_CLASSES[size],
          TONE_CLASSES[tone]
        )}
      >
        {icon}
      </Tooltip.Trigger>
      <Tooltip.Content side="top">{tooltip}</Tooltip.Content>
    </Tooltip.Root>
  );
}
