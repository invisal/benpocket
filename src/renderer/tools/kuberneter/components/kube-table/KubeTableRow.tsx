import { cn } from 'cnfast';
import { type Column } from './types';
import { KubeTableCell } from './KubeTableCell';

interface KubeTableRowProps<T> {
  row: T;
  columns: Column<T>[];
  getRowKey: (row: T, index?: number) => string | number;
  onRowClick?: (row: T) => void;
  selectedRowKey?: string | number;
  colWidths: Record<string, number>;
  resizable?: boolean;
}

export function KubeTableRow<T>({
  row,
  columns,
  getRowKey,
  onRowClick,
  selectedRowKey,
  colWidths,
  resizable
}: KubeTableRowProps<T>) {
  const key = getRowKey(row);
  const isSelected = selectedRowKey !== undefined && selectedRowKey === key;

  return (
    <tr
      onClick={() => onRowClick?.(row)}
      className={cn(
        'transition-colors duration-100 border-b border-border-dark/30 hover:bg-surface-2/45',
        onRowClick && 'cursor-pointer',
        isSelected && 'bg-surface-3/80 text-white font-medium'
      )}
    >
      {columns.map((col) => (
        <KubeTableCell<T>
          key={col.key}
          row={row}
          col={col}
          colWidth={colWidths[col.key]}
          resizable={resizable}
        />
      ))}
    </tr>
  );
}
