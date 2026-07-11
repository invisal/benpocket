import React from 'react';

export interface Column<T> {
  key: string;
  header: React.ReactNode;
  render?: (row: T) => React.ReactNode;
  className?: string;
  headerClassName?: string;
  align?: 'left' | 'center' | 'right';
}

interface KubeTableProps<T> {
  columns: Column<T>[];
  data: T[];
  onRowClick?: (row: T) => void;
  selectedRowKey?: string | number;
  getRowKey: (row: T) => string | number;
  emptyState?: React.ReactNode;
  className?: string;
}

export function KubeTable<T>({
  columns,
  data,
  onRowClick,
  selectedRowKey,
  getRowKey,
  emptyState,
  className
}: KubeTableProps<T>) {
  return (
    <div className={`overflow-x-auto flex-1 ${className || ''}`}>
      <table className="w-full text-left border-collapse text-xs border border-border/20">
        <thead>
          <tr className="bg-transparent text-zinc-455 text-[10px] font-bold uppercase tracking-wider">
            {columns.map((col) => {
              const alignClass =
                col.align === 'center'
                  ? 'text-center'
                  : col.align === 'right'
                    ? 'text-right'
                    : 'text-left';
              return (
                <th
                  key={col.key}
                  className={`p-2 font-sans select-none border border-border/20 bg-surface-2/20 ${alignClass} ${col.headerClassName || ''}`}
                >
                  {col.header}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="text-zinc-350 bg-transparent">
          {data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="p-8 text-center text-zinc-550 italic font-sans border border-border/20"
              >
                {emptyState || 'No data available'}
              </td>
            </tr>
          ) : (
            data.map((row) => {
              const key = getRowKey(row);
              const isSelected = selectedRowKey !== undefined && selectedRowKey === key;
              return (
                <tr
                  key={key}
                  onClick={() => onRowClick?.(row)}
                  className={`transition-colors duration-100 ${
                    onRowClick ? 'cursor-pointer hover:bg-border/20' : ''
                  } ${isSelected ? 'bg-border/30 text-zinc-150' : ''}`}
                >
                  {columns.map((col) => {
                    const alignClass =
                      col.align === 'center'
                        ? 'text-center'
                        : col.align === 'right'
                          ? 'text-right'
                          : 'text-left';
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const content = col.render ? col.render(row) : (row as any)[col.key];
                    return (
                      <td
                        key={col.key}
                        className={`p-2 align-middle font-sans border border-border/20 select-text ${alignClass} ${col.className || ''}`}
                      >
                        {content}
                      </td>
                    );
                  })}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
