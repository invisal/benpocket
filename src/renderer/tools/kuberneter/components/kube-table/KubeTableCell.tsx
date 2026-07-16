import { cn } from 'cnfast';
import { type Column } from './types';

interface KubeTableCellProps<T> {
  row: T;
  col: Column<T>;
  colWidth: number | undefined;
  isModern: boolean;
  resizable: boolean;
}

export function KubeTableCell<T>({
  row,
  col,
  colWidth,
  isModern,
  resizable
}: KubeTableCellProps<T>) {
  const alignClass =
    col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const content = col.render ? col.render(row) : (row as any)[col.key];

  return (
    <td
      className={cn(
        'p-2 align-middle font-sans select-text overflow-hidden',
        alignClass,
        isModern ? 'py-2.5 border-none' : 'border border-border/20',
        col.className
      )}
      style={resizable && colWidth !== undefined ? { maxWidth: colWidth } : undefined}
    >
      <div className="truncate">{content}</div>
    </td>
  );
}
