import type React from 'react';
import { useState, useRef, useCallback, useEffect } from 'react';
import { cn } from 'cnfast';
import { AlertCircle } from 'lucide-react';
import { type KubeTableProps, type Column } from './types';
import { KubeTableHeader } from './KubeTableHeader';
import { KubeTableRow } from './KubeTableRow';

const DEFAULT_COL_WIDTH = 140;
const MIN_COL_WIDTH = 40;

export function KubeTable<T>({
  columns,
  data,
  onRowClick,
  selectedRowKey,
  getRowKey,
  emptyState,
  emptyMessage,
  hideHeaderWhenEmpty,
  className,
  variant = 'standard',
  resizable = true,
  rowHeight
}: KubeTableProps<T>) {
  const isModern = variant === 'modern';

  // Initialize column widths from initialWidth prop or default
  const [colWidths, setColWidths] = useState<Record<string, number>>(() =>
    Object.fromEntries(columns.map((col) => [col.key, col.initialWidth ?? DEFAULT_COL_WIDTH]))
  );

  // Scroll state & height measurement for windowing/virtualization
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(400);

  const rHeight = rowHeight ?? (isModern ? 38 : 36);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    setContainerHeight(el.clientHeight);

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerHeight(entry.contentRect.height || el.clientHeight);
      }
    });
    observer.observe(el);

    return () => {
      observer.disconnect();
    };
  }, []);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  };

  // Ref to track active resize state without causing re-renders during drag
  const resizingRef = useRef<{
    colKey: string;
    startX: number;
    startWidth: number;
  } | null>(null);

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!resizingRef.current) return;
    const { colKey, startX, startWidth } = resizingRef.current;
    const delta = e.clientX - startX;
    const newWidth = Math.max(MIN_COL_WIDTH, startWidth + delta);
    setColWidths((prev) => ({ ...prev, [colKey]: newWidth }));
  }, []);

  const onMouseUp = useCallback(() => {
    resizingRef.current = null;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  useEffect(() => {
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, [onMouseMove, onMouseUp]);

  const startResize = useCallback(
    (e: React.MouseEvent, colKey: string) => {
      e.preventDefault();
      e.stopPropagation();
      resizingRef.current = {
        colKey,
        startX: e.clientX,
        startWidth: colWidths[colKey] ?? DEFAULT_COL_WIDTH
      };
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    },
    [colWidths]
  );

  const isColResizable = (col: Column<T>) => resizable && col.resizable !== false;

  // Windowing calculation
  const buffer = 8;
  const startIndex = Math.max(0, Math.floor(scrollTop / rHeight) - buffer);
  const endIndex = Math.min(
    data.length,
    Math.ceil((scrollTop + containerHeight) / rHeight) + buffer
  );
  const visibleData = data.slice(startIndex, endIndex);

  const spacerTopHeight = startIndex * rHeight;
  const spacerBottomHeight = (data.length - endIndex) * rHeight;

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className={cn(
        'overflow-auto flex-1 relative kube-table-container bg-transparent',
        isModern && 'border-t border-border-dark',
        className
      )}
    >
      <table
        className="text-left text-xs bg-transparent"
        style={
          resizable && data.length > 0
            ? {
                tableLayout: 'fixed',
                width: Object.values(colWidths).reduce((a, b) => a + b, 0),
                minWidth: '100%',
                borderCollapse: 'collapse'
              }
            : { width: '100%', borderCollapse: 'collapse' }
        }
      >
        {/* colgroup defines fixed widths per column */}
        {resizable && (
          <colgroup>
            {columns.map((col) => (
              <col key={col.key} style={{ width: colWidths[col.key] ?? DEFAULT_COL_WIDTH }} />
            ))}
          </colgroup>
        )}

        <KubeTableHeader
          columns={columns}
          colWidths={colWidths}
          isModern={isModern}
          hideHeaderWhenEmpty={hideHeaderWhenEmpty}
          dataLength={data.length}
          resizable={resizable}
          startResize={startResize}
          isColResizable={isColResizable}
        />

        <tbody className="text-zinc-350 bg-transparent">
          {data.length === 0 ? (
            <tr className="bg-transparent">
              <td
                colSpan={columns.length}
                className={cn(
                  'p-8 text-center text-zinc-550 italic font-sans bg-transparent',
                  isModern ? 'border-b border-border-dark/30' : 'border border-border/20'
                )}
              >
                {emptyState || (
                  <div className="w-full flex flex-col items-center justify-center text-zinc-550 gap-2 py-10 font-sans not-italic">
                    <AlertCircle className="size-8 text-zinc-650" />
                    <span className="text-xs">{emptyMessage || 'No data available'}</span>
                  </div>
                )}
              </td>
            </tr>
          ) : (
            <>
              {spacerTopHeight > 0 && (
                <tr style={{ height: spacerTopHeight }}>
                  <td colSpan={columns.length} style={{ padding: 0, height: spacerTopHeight }} />
                </tr>
              )}
              {visibleData.map((row) => (
                <KubeTableRow<T>
                  key={getRowKey(row)}
                  row={row}
                  columns={columns}
                  getRowKey={getRowKey}
                  onRowClick={onRowClick}
                  selectedRowKey={selectedRowKey}
                  colWidths={colWidths}
                  isModern={isModern}
                  resizable={resizable}
                />
              ))}
              {spacerBottomHeight > 0 && (
                <tr style={{ height: spacerBottomHeight }}>
                  <td colSpan={columns.length} style={{ padding: 0, height: spacerBottomHeight }} />
                </tr>
              )}
            </>
          )}
        </tbody>
      </table>
    </div>
  );
}
