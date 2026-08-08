import type { ReactNode } from 'react';
import cn from 'cnfast';

interface FloatingToolbarProps {
  children: ReactNode;
  className?: string;
}

/**
 * A floating control bar docked to the bottom of the previewer, over the canvas -- not the app's
 * `Toolbar` primitive (which assumes a fixed single-row height), since a tool with many controls
 * (Crop) needs to wrap onto multiple lines and grow its own height instead of overflowing.
 * `pointer-events-none` on the full-width wrapper keeps the canvas underneath it interactive;
 * `pointer-events-auto` re-enables clicks/drags on the pill itself.
 */
export function FloatingToolbar({ children, className }: FloatingToolbarProps) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center px-3">
      <div
        className={cn(
          'pointer-events-auto flex max-w-full flex-wrap items-center justify-center gap-x-1 gap-y-1.5',
          'rounded-xl border border-border-dark bg-surface/95 px-2 py-1.5 shadow-lg backdrop-blur-sm',
          className
        )}
      >
        {children}
      </div>
    </div>
  );
}
