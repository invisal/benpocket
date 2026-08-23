import { cn } from 'cnfast';
import { formatShortcut } from '@renderer/lib/shortcut';

interface ShortcutBadgeProps {
  accelerator: string;
  className?: string;
}

/** Renders a bound accelerator as one `<kbd>` chip per key. */
export function ShortcutBadge({ accelerator, className }: ShortcutBadgeProps) {
  return (
    <div className={cn('flex items-center gap-1', className)}>
      {formatShortcut(accelerator)
        .split('+')
        .map((part, i) => (
          <kbd
            key={i}
            className="rounded-sm border border-border bg-surface px-1.5 py-0.5 text-sm font-medium shadow-[0_1px_0_0_var(--color-border)]"
          >
            {part}
          </kbd>
        ))}
    </div>
  );
}
