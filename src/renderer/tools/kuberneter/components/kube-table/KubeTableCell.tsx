import { cn } from 'cnfast';
import { type Column } from './types';
import { ROW_HEIGHT } from './constants';

interface KubeTableCellProps<T> {
  row: T;
  col: Column<T>;
  colWidth: number | undefined;
  resizable?: boolean;
  isExpanded?: boolean;
}

export function KubeTableCell<T>({
  row,
  col,
  colWidth,
  resizable = true,
  isExpanded
}: KubeTableCellProps<T>) {
  const alignClass =
    col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const content = col.render ? col.render(row) : (row as any)[col.key];

  return (
    <td
      className={cn(
        'px-2 align-middle font-sans select-text border-none',
        isExpanded ? 'py-2 overflow-visible' : 'overflow-hidden',
        alignClass,
        col.className
      )}
      style={isExpanded ? { minHeight: ROW_HEIGHT, height: 'auto' } : { height: ROW_HEIGHT }}
    >
      <div
        className={cn(isExpanded ? 'whitespace-normal break-all' : 'truncate')}
        style={
          resizable && colWidth !== undefined && !isExpanded ? { maxWidth: colWidth } : undefined
        }
      >
        {content}
      </div>
    </td>
  );
}
