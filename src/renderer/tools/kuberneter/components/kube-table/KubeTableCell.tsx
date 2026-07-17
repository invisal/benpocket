import { cn } from 'cnfast';
import { type Column } from './types';
import { ROW_HEIGHT } from './constants';

interface KubeTableCellProps<T> {
  row: T;
  col: Column<T>;
  colWidth: number | undefined;
  resizable?: boolean;
}

export function KubeTableCell<T>({ row, col, colWidth, resizable = true }: KubeTableCellProps<T>) {
  const alignClass =
    col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const content = col.render ? col.render(row) : (row as any)[col.key];

  return (
    <td
      className={cn(
        'px-2 align-middle font-sans select-text overflow-hidden border-none',
        alignClass,
        col.className
      )}
      style={{ height: ROW_HEIGHT }}
    >
      <div
        className="truncate"
        style={resizable && colWidth !== undefined ? { maxWidth: colWidth } : undefined}
      >
        {content}
      </div>
    </td>
  );
}
