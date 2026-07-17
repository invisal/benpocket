import type React from 'react';
import { useState, useRef, useCallback, useEffect, useMemo, Fragment } from 'react';
import { cn } from 'cnfast';
import { AlertCircle } from 'lucide-react';
import { type KubeTableProps } from './types';
import { ROW_HEIGHT } from './constants';
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
  resizable = true,
  borderTop = false,
  showHeader = true,
  renderRowExpansion,
  expandedRowKeys
}: KubeTableProps<T>) {
  // Initialize column widths from initialWidth prop or default
  const [colWidths, setColWidths] = useState<Record<string, number>>(() =>
    Object.fromEntries(columns.map((col) => [col.key, col.initialWidth ?? DEFAULT_COL_WIDTH]))
  );

  // Scroll state & height measurement for windowing/virtualization
  const containerRef = useRef<HTMLDivElement | null>(null);
  const headerRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(400);

  const rHeight = ROW_HEIGHT;

  // Sorting state
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc' | null>(null);

  const handleSort = useCallback(
    (colKey: string) => {
      const col = columns.find((c) => c.key === colKey);
      if (col?.sortable === false) return;

      if (sortCol === colKey) {
        if (sortDir === 'asc') {
          setSortDir('desc');
        } else if (sortDir === 'desc') {
          setSortCol(null);
          setSortDir(null);
        } else {
          setSortDir('asc');
        }
      } else {
        setSortCol(colKey);
        setSortDir('asc');
      }
    },
    [columns, sortCol, sortDir]
  );

  const sortedData = useMemo(() => {
    if (!sortCol || !sortDir) return data;

    const column = columns.find((c) => c.key === sortCol);
    if (!column) return data;

    return [...data].sort((a, b) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const valA = column.sortValue ? column.sortValue(a) : (a as any)[sortCol];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const valB = column.sortValue ? column.sortValue(b) : (b as any)[sortCol];

      if (valA === valB) return 0;
      if (valA == null) return 1;
      if (valB == null) return -1;

      const factor = sortDir === 'asc' ? 1 : -1;

      if (typeof valA === 'string' && typeof valB === 'string') {
        return valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' }) * factor;
      }

      return (valA < valB ? -1 : 1) * factor;
    });
  }, [data, sortCol, sortDir, columns]);

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
    // Synchronize horizontal scrolling of header and body tables
    if (headerRef.current) {
      headerRef.current.scrollLeft = e.currentTarget.scrollLeft;
    }
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

  const isColResizable = () => true;

  // Windowing calculation
  const buffer = 8;
  const startIndex = Math.max(0, Math.floor(scrollTop / rHeight) - buffer);
  const endIndex = Math.min(
    sortedData.length,
    Math.ceil((scrollTop + containerHeight) / rHeight) + buffer
  );
  const visibleData = sortedData.slice(startIndex, endIndex);

  const spacerTopHeight = startIndex * rHeight;
  const spacerBottomHeight = (sortedData.length - endIndex) * rHeight;

  const tableWidth = Object.values(colWidths).reduce((a, b) => a + b, 0);

  const tableStyle: React.CSSProperties = {
    tableLayout: 'fixed',
    width: resizable ? tableWidth : '100%',
    borderCollapse: 'collapse'
  };

  return (
    <div
      className={cn(
        'flex flex-col flex-1 min-h-0 bg-transparent',
        borderTop && 'border-t border-border-dark/60',
        className
      )}
    >
      {/* 1. Dedicated Header Container (fixed vertical position) */}
      {showHeader && (!hideHeaderWhenEmpty || sortedData.length > 0) && (
        <div ref={headerRef} className={cn('shrink-0 overflow-hidden select-none bg-sidebar-bg')}>
          <table className="text-left text-xs bg-transparent" style={tableStyle}>
            <colgroup>
              {columns.map((col, idx) => {
                const isLast = idx === columns.length - 1;
                const width = colWidths[col.key] ?? DEFAULT_COL_WIDTH;
                return <col key={col.key} style={!resizable && isLast ? undefined : { width }} />;
              })}
            </colgroup>
            <KubeTableHeader
              columns={columns}
              colWidths={colWidths}
              hideHeaderWhenEmpty={hideHeaderWhenEmpty}
              dataLength={sortedData.length}
              resizable={resizable}
              startResize={startResize}
              isColResizable={isColResizable}
              sortCol={sortCol}
              sortDir={sortDir}
              onSort={handleSort}
            />
          </table>
        </div>
      )}

      {/* 2. Scrollable Body Container (scrollbar resides entirely by table rows) */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="overflow-auto flex-1 relative kube-table-container bg-transparent"
      >
        <table className="text-left text-xs bg-transparent" style={tableStyle}>
          <colgroup>
            {columns.map((col, idx) => {
              const isLast = idx === columns.length - 1;
              const width = colWidths[col.key] ?? DEFAULT_COL_WIDTH;
              return <col key={col.key} style={!resizable && isLast ? undefined : { width }} />;
            })}
          </colgroup>

          <tbody className="text-zinc-350 bg-transparent">
            {sortedData.length === 0 ? (
              <tr className="bg-transparent">
                <td
                  colSpan={columns.length}
                  className={cn(
                    'p-8 text-center text-zinc-550 italic font-sans bg-transparent',
                    'border-b border-border-dark/30'
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
                {visibleData.map((row, index) => {
                  const key = getRowKey(row, index);
                  const isExpanded = expandedRowKeys?.has(key);
                  return (
                    <Fragment key={key}>
                      <KubeTableRow<T>
                        row={row}
                        columns={columns}
                        getRowKey={(r) => getRowKey(r, index)}
                        onRowClick={onRowClick}
                        selectedRowKey={selectedRowKey}
                        colWidths={colWidths}
                        resizable={resizable}
                      />
                      {renderRowExpansion && isExpanded && (
                        <tr className="bg-surface-1/10 border-b border-border-dark/20">
                          <td colSpan={columns.length} className="p-3 select-text">
                            {renderRowExpansion(row)}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
                {spacerBottomHeight > 0 && (
                  <tr style={{ height: spacerBottomHeight }}>
                    <td
                      colSpan={columns.length}
                      style={{ padding: 0, height: spacerBottomHeight }}
                    />
                  </tr>
                )}
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
