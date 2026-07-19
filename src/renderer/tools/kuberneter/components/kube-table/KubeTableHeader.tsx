import type React from 'react';
import { cn } from 'cnfast';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { type Column } from './types';
import { ROW_HEIGHT } from './constants';

interface KubeTableHeaderProps<T> {
  columns: Column<T>[];
  colWidths: Record<string, number>;
  hideHeaderWhenEmpty?: boolean;
  dataLength: number;
  resizable: boolean;
  startResize: (e: React.MouseEvent, colKey: string) => void;
  isColResizable: (colKey: string) => boolean;
  sortCol: string | null;
  sortDir: 'asc' | 'desc' | null;
  onSort: (colKey: string) => void;
}

export function KubeTableHeader<T>({
  columns,
  colWidths,
  hideHeaderWhenEmpty,
  dataLength,
  resizable,
  startResize,
  isColResizable,
  sortCol,
  sortDir,
  onSort
}: KubeTableHeaderProps<T>) {
  if (hideHeaderWhenEmpty && dataLength === 0) {
    return null;
  }

  return (
    <thead className="sticky top-0 z-10 bg-surface-2 text-zinc-455 text-[10px] font-bold uppercase tracking-wider">
      <tr>
        {columns.map((col) => {
          const alignClass =
            col.align === 'center'
              ? 'text-center'
              : col.align === 'right'
                ? 'text-right'
                : 'text-left';
          const canResize = isColResizable(col.key);
          const colWidth = colWidths[col.key];
          const isSortable = col.sortable !== false && col.resizable !== false;
          const isSorted = sortCol === col.key;

          return (
            <th
              key={col.key}
              className={cn(
                'font-sans select-none relative group bg-surface-2 text-zinc-400 font-semibold',
                canResize ? 'px-3' : 'px-2',
                alignClass,
                col.headerClassName
              )}
              style={{
                height: ROW_HEIGHT,
                ...(resizable && colWidth !== undefined ? { width: colWidth } : undefined)
              }}
            >
              {canResize ? (
                /* Resizable column: flex wrapper with truncate + sort button */
                <div
                  className="flex items-center gap-1.5 min-w-0"
                  style={colWidth !== undefined ? { maxWidth: colWidth - 16 } : undefined}
                >
                  <span className="block truncate">{col.header}</span>
                  {isSortable && (
                    <button
                      type="button"
                      onClick={() => onSort(col.key)}
                      className="inline-flex shrink-0 text-zinc-550 hover:text-accent cursor-pointer transition-colors focus:outline-none"
                      title={`Sort by ${typeof col.header === 'string' ? col.header : col.key}`}
                    >
                      {isSorted ? (
                        sortDir === 'asc' ? (
                          <ChevronUp className="size-3 text-accent" />
                        ) : (
                          <ChevronDown className="size-3 text-accent" />
                        )
                      ) : (
                        <ChevronsUpDown className="size-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                      )}
                    </button>
                  )}
                </div>
              ) : (
                /* Fixed column (checkbox / warning / actions): render content directly, centered */
                <div className="flex items-center justify-center w-full">{col.header}</div>
              )}

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
