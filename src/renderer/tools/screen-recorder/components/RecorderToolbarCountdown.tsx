import type { JSX, RefObject } from 'react';
import { cn } from 'cnfast';
import { DRAG, NO_DRAG, disablePointerEvents, enablePointerEvents } from '../lib/pointer-events';

export function RecorderToolbarCountdown({
  countdownRemaining,
  onCancel,
  pillRef
}: {
  countdownRemaining: number | null;
  onCancel: () => void;
  pillRef: RefObject<HTMLDivElement | null>;
}): JSX.Element {
  return (
    <div className="relative flex h-full items-end justify-center pb-4">
      <div className="absolute inset-0" onMouseEnter={disablePointerEvents} />
      <div
        ref={pillRef}
        onMouseEnter={enablePointerEvents}
        className={cn(
          DRAG,
          'flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-full border border-border bg-surface/95 shadow-[0_0_28px_rgba(0,0,0,0.3)] backdrop-blur'
        )}
      >
        <span className="font-mono text-4xl font-semibold text-foreground">
          {countdownRemaining}
        </span>
        <button
          onClick={onCancel}
          className={cn(NO_DRAG, 'text-[10px] text-muted-foreground hover:text-foreground')}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
