import type { JSX } from 'react';
import { Scissors } from 'lucide-react';
import { formatShortDuration } from '../lib/timeline-format';
import { cn } from '../../../lib/utils';

/**
 * Map-pin-shaped scissors badge -- a single teardrop (a rounded square with
 * one sharp corner, rotated so that corner points straight down) whose tip
 * touches the exact cut point, with the scissors icon and duration stacked
 * inside its round head. `anchorClassName` supplies both the horizontal
 * anchor edge (`left-0` / `right-0`) and the matching outward half-width
 * translate (`-translate-x-1/2` / `translate-x-1/2`) that recenters the pin
 * on that edge, so the tip always lands exactly on the cut regardless of
 * which side it's anchored from, rather than merely flush against it.
 */
export function CutMarker({
  durationMs,
  anchorClassName
}: {
  /** Omitted for the cut tool's live preview pin, which follows the cursor before any cut has actually been made -- there's no trimmed duration to show yet. */
  durationMs?: number;
  anchorClassName: string;
}): JSX.Element {
  return (
    <div className={cn('pointer-events-none absolute -top-10 z-10', anchorClassName)}>
      <div className="relative h-9 w-9">
        <div className="absolute inset-0 -rotate-45 rounded-[50%_50%_50%_0] border-2 border-accent bg-surface-3 shadow-sm" />
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-px pt-0.5">
          <Scissors size={12} className="text-foreground" />
          {durationMs !== undefined && (
            <span className="whitespace-nowrap text-[9px] font-medium leading-none text-foreground">
              {formatShortDuration(durationMs)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
