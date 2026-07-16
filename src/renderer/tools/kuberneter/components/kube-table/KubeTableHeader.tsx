import type React from 'react';
import { cn } from 'cnfast';
import { type Column } from './types';

interface KubeTableHeaderProps<T> {
  columns: Column<T>[];
  colWidths: Record<string, number>;
  isModern: boolean;
  hideHeaderWhenEmpty?: boolean;
  dataLength: number;
  resizable: boolean;
  startResize: (e: React.MouseEvent, colKey: string) => void;
  isColResizable: (col: Column<T>) => boolean;
}

export function KubeTableHeader<T>({
  columns,
  colWidths,
  isModern,
  hideHeaderWhenEmpty,
  dataLength,
  resizable,
  startResize,
  isColResizable
}: KubeTableHeaderProps<T>) {
  if (hideHeaderWhenEmpty && dataLength === 0) {
    return null;
  }

  return (
    <thead
      className={cn(
        'sticky top-0 z-10',
        isModern
          ? 'bg-sidebar-bg text-zinc-455 text-[10px] font-bold uppercase tracking-wider'
          : 'bg-surface-2 border border-border/20'
      )}
    >
      <tr>
        {columns.map((col) => {
          const alignClass =
            col.align === 'center'
              ? 'text-center'
              : col.align === 'right'
                ? 'text-right'
                : 'text-left';
          const canResize = isColResizable(col);
          const colWidth = colWidths[col.key];

          return (
            <th
              key={col.key}
              className={cn(
                'font-sans select-none relative',
                alignClass,
                isModern
                  ? 'bg-sidebar-bg py-2.5 px-3 border-b border-border-dark/60 text-zinc-400 font-semibold'
                  : 'bg-surface-2 py-2.5 px-2 border border-border/20',
                col.headerClassName
              )}
              style={resizable && colWidth !== undefined ? { width: colWidth } : undefined}
            >
              <span className="block truncate">{col.header}</span>

              {/* Resize handle — always-visible separator, accent on hover */}
              {canResize && (
                <div
                  onMouseDown={(e) => startResize(e, col.key)}
                  className="absolute right-0 top-0 h-full w-4 z-20 cursor-col-resize flex items-center justify-end group/handle"
                  title="Drag to resize"
                >
                  <div className="w-px h-4/5 bg-border-dark group-hover/handle:bg-accent transition-colors duration-100" />
                </div>
              )}
            </th>
          );
        })}
      </tr>
    </thead>
  );
}
