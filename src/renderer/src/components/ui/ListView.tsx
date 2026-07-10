import { ReactNode } from 'react';
import { flexRender, Table } from '@tanstack/react-table';
import { cn } from 'cnfast';

interface ListViewProps<TData> {
  table: Table<TData>;
  getRowId: (row: TData) => string;
  isRowSelected?: (row: TData) => boolean;
  onRowClick?: (row: TData) => void;
  onRowDoubleClick?: (row: TData) => void;
  emptyState?: ReactNode;
}

export function ListView<TData>({
  table,
  getRowId,
  isRowSelected,
  onRowClick,
  onRowDoubleClick,
  emptyState
}: ListViewProps<TData>) {
  const rows = table.getRowModel().rows;

  if (rows.length === 0 && emptyState) {
    return <>{emptyState}</>;
  }

  const gridTemplateColumns = table
    .getFlatHeaders()
    .map((header) => `${header.getSize()}px`)
    .join(' ');

  return (
    <div className="flex-1 overflow-auto min-h-0" role="table">
      <div role="rowgroup" className="sticky top-0 z-10">
        {table.getHeaderGroups().map((headerGroup) => (
          <div
            key={headerGroup.id}
            role="row"
            style={{ display: 'grid', gridTemplateColumns }}
            className="bg-surface-2 border-b border-border-dark text-zinc-450 text-[10px] text-xs font-medium  tracking-wider"
          >
            {headerGroup.headers.map((header) => (
              <div
                key={header.id}
                role="columnheader"
                className="relative hover:bg-surface-3 px-3 py-1.5 cursor-pointer select-none truncate"
                onClick={header.column.getToggleSortingHandler()}
              >
                {flexRender(header.column.columnDef.header, header.getContext())}
                {header.column.getIsSorted() === 'asc' && ' ▲'}
                {header.column.getIsSorted() === 'desc' && ' ▼'}
                <div
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={header.getResizeHandler()}
                  onTouchStart={header.getResizeHandler()}
                  className="group absolute -right-1.5 top-0 z-10 flex h-full w-3 cursor-col-resize touch-none select-none items-center justify-center"
                >
                  <div
                    className={cn(
                      'h-full w-px bg-border-dark group-hover:bg-accent',
                      header.column.getIsResizing() && 'bg-accent'
                    )}
                  />
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
      <div role="rowgroup">
        {rows.map((row) => {
          const entry = row.original;
          const id = getRowId(entry);
          return (
            <div
              key={id}
              role="row"
              style={{ display: 'grid', gridTemplateColumns }}
              onClick={() => onRowClick?.(entry)}
              onDoubleClick={() => onRowDoubleClick?.(entry)}
              className={cn(
                'hover:bg-surface-2 cursor-pointer',
                isRowSelected?.(entry) && 'bg-surface-3'
              )}
            >
              {row.getVisibleCells().map((cell) => (
                <div key={cell.id} role="cell" className="p-1.5 px-3 text-xs min-w-0 truncate">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
