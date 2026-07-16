import { cn } from 'cnfast';
import { type Column } from './types';
import { KubeTableCell } from './KubeTableCell';

interface KubeTableRowProps<T> {
  row: T;
  columns: Column<T>[];
  getRowKey: (row: T) => string | number;
  onRowClick?: (row: T) => void;
  selectedRowKey?: string | number;
  colWidths: Record<string, number>;
  isModern: boolean;
}

export function KubeTableRow<T>({
  row,
  columns,
  getRowKey,
  onRowClick,
  selectedRowKey,
  colWidths,
  isModern
}: KubeTableRowProps<T>) {
  const key = getRowKey(row);
  const isSelected = selectedRowKey !== undefined && selectedRowKey === key;

  return (
    <tr
      onClick={() => onRowClick?.(row)}
      className={cn(
        'transition-colors duration-100',
        onRowClick && 'cursor-pointer',
        isModern
          ? cn(
              'hover:bg-surface-2/45 border-b border-border-dark/30 last:border-b-0',
              isSelected && 'bg-surface-3/80 text-white font-medium'
            )
          : cn('hover:bg-border/20', isSelected && 'bg-border/30 text-zinc-150')
      )}
    >
      {columns.map((col) => (
        <KubeTableCell<T>
          key={col.key}
          row={row}
          col={col}
          colWidth={colWidths[col.key]}
          isModern={isModern}
        />
      ))}
    </tr>
  );
}
