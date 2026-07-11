import React, { useCallback, useRef } from 'react';
import { cn } from 'cnfast';

export type ResizablePanelEdge = 'left' | 'right' | 'top' | 'bottom';
export type ResizablePanelUnit = 'px' | '%';

interface ResizablePanelProps {
  /** Which side of the panel the drag handle sits on; also determines resize direction and drag sign */
  edge: ResizablePanelEdge;
  size: number;
  onResize: (newSize: number) => void;
  min?: number;
  max?: number;
  /** Whether `size`/`min`/`max` are pixels or a percentage of the parent container. Defaults to 'px'. */
  unit?: ResizablePanelUnit;
  className?: string;
  children?: React.ReactNode;
}

const edgeClasses: Record<ResizablePanelEdge, string> = {
  left: 'top-0 left-0 w-[3px] h-full cursor-col-resize',
  right: 'top-0 right-0 w-[3px] h-full cursor-col-resize',
  top: 'top-0 left-0 w-full h-[3px] cursor-row-resize',
  bottom: 'bottom-0 left-0 w-full h-[3px] cursor-row-resize'
};

export function ResizablePanel({
  edge,
  size,
  onResize,
  min = -Infinity,
  max = Infinity,
  unit = 'px',
  className = '',
  children
}: ResizablePanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const direction = edge === 'left' || edge === 'right' ? 'horizontal' : 'vertical';
  const sizeProp = direction === 'horizontal' ? 'width' : 'height';

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const startPos = direction === 'horizontal' ? e.clientX : e.clientY;
      const startSize = size;
      // Dragging toward the right/bottom grows the panel when the handle sits on that edge,
      // and shrinks it (so we invert) when the handle sits on the opposite edge.
      const sign = edge === 'right' || edge === 'bottom' ? 1 : -1;
      // In '%' mode, the parent's size at drag-start converts pixel mouse deltas into
      // percentage deltas -- this keeps the drag feeling equally smooth as px mode while
      // the committed size stays a CSS percentage that reflows automatically on container resize.
      const containerSize =
        direction === 'horizontal'
          ? (panelRef.current?.parentElement?.clientWidth ?? 1)
          : (panelRef.current?.parentElement?.clientHeight ?? 1);
      let latestSize = startSize;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const currentPos = direction === 'horizontal' ? moveEvent.clientX : moveEvent.clientY;
        const delta = sign * (currentPos - startPos);
        const deltaInUnit = unit === '%' ? (delta / containerSize) * 100 : delta;
        latestSize = Math.max(min, Math.min(startSize + deltaInUnit, max));
        // Mutate the DOM directly during the drag for live feedback without re-rendering React
        // on every mousemove; onResize below commits it once, on release.
        panelRef.current?.style.setProperty(sizeProp, `${latestSize}${unit}`);
      };

      const handleMouseUp = () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        onResize(latestSize);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [direction, edge, size, min, max, unit, onResize, sizeProp]
  );

  return (
    <div
      ref={panelRef}
      style={{ [sizeProp]: `${size}${unit}` }}
      className={cn('relative shrink-0', className)}
    >
      {children}
      <div
        onMouseDown={handleMouseDown}
        className={cn(
          'absolute',
          edgeClasses[edge],
          'hover:bg-accent/30 active:bg-accent transition-colors z-40'
        )}
      />
    </div>
  );
}
