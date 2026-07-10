import { Fragment, KeyboardEvent, MouseEvent, ReactNode, useMemo, useRef, useState } from 'react';
import { flexRender, Table } from '@tanstack/react-table';
import { cn } from 'cnfast';
import { ContextMenu } from './ContextMenu';

interface ListViewContextMenuArgs<TData> {
  row: TData;
  selectedRows: TData[];
}

interface ListViewProps<TData> {
  table: Table<TData>;
  getRowId: (row: TData) => string;
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  onRowClick?: (row: TData) => void;
  onRowDoubleClick?: (row: TData) => void;
  renderContextMenu?: (args: ListViewContextMenuArgs<TData>) => ReactNode;
  emptyState?: ReactNode;
}

export function ListView<TData>({
  table,
  getRowId,
  selectedIds,
  onSelectionChange,
  onRowClick,
  onRowDoubleClick,
  renderContextMenu,
  emptyState
}: ListViewProps<TData>) {
  const rows = table.getRowModel().rows;
  const containerRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef(new Map<string, HTMLDivElement>());
  const anchorIdRef = useRef<string | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [isFocusWithin, setIsFocusWithin] = useState(false);

  const effectiveFocusedId = useMemo(() => {
    if (focusedId && rows.some((r) => getRowId(r.original) === focusedId)) return focusedId;
    if (selectedIds.size > 0) {
      const selectedRow = rows.find((r) => selectedIds.has(getRowId(r.original)));
      if (selectedRow) return getRowId(selectedRow.original);
    }
    return rows[0] ? getRowId(rows[0].original) : null;
  }, [focusedId, rows, selectedIds, getRowId]);

  const selectedRows = useMemo(
    () => rows.filter((r) => selectedIds.has(getRowId(r.original))).map((r) => r.original),
    [rows, selectedIds, getRowId]
  );

  if (rows.length === 0 && emptyState) {
    return <>{emptyState}</>;
  }

  const gridTemplateColumns = table
    .getFlatHeaders()
    .map((header) => `${header.getSize()}px`)
    .join(' ');

  const idsInRange = (fromId: string, toId: string) => {
    const fromIndex = rows.findIndex((r) => getRowId(r.original) === fromId);
    const toIndex = rows.findIndex((r) => getRowId(r.original) === toId);
    const [start, end] = fromIndex <= toIndex ? [fromIndex, toIndex] : [toIndex, fromIndex];
    const ids = new Set<string>();
    for (let i = start; i <= end; i++) ids.add(getRowId(rows[i].original));
    return ids;
  };

  const moveFocus = (index: number, extend: boolean) => {
    if (rows.length === 0) return;
    const clamped = Math.min(Math.max(index, 0), rows.length - 1);
    const id = getRowId(rows[clamped].original);
    setFocusedId(id);
    rowRefs.current.get(id)?.scrollIntoView({ block: 'nearest' });
    if (extend && anchorIdRef.current) {
      onSelectionChange(idsInRange(anchorIdRef.current, id));
    } else {
      onSelectionChange(new Set([id]));
      anchorIdRef.current = id;
    }
  };

  const handleRowClick = (entry: TData, id: string, e: MouseEvent<HTMLDivElement>) => {
    containerRef.current?.focus();
    if (e.shiftKey && anchorIdRef.current) {
      onSelectionChange(idsInRange(anchorIdRef.current, id));
    } else if (e.ctrlKey || e.metaKey) {
      const next = new Set(selectedIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      onSelectionChange(next);
      anchorIdRef.current = id;
    } else {
      onSelectionChange(new Set([id]));
      anchorIdRef.current = id;
    }
    setFocusedId(id);
    onRowClick?.(entry);
  };

  const handleRowContextMenu = (id: string) => {
    containerRef.current?.focus();
    if (!selectedIds.has(id)) {
      onSelectionChange(new Set([id]));
      anchorIdRef.current = id;
    }
    setFocusedId(id);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (rows.length === 0 || effectiveFocusedId === null) return;
    const currentIndex = rows.findIndex((r) => getRowId(r.original) === effectiveFocusedId);

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        moveFocus(currentIndex + 1, e.shiftKey);
        break;
      case 'ArrowUp':
        e.preventDefault();
        moveFocus(currentIndex - 1, e.shiftKey);
        break;
      case 'Home':
        e.preventDefault();
        moveFocus(0, e.shiftKey);
        break;
      case 'End':
        e.preventDefault();
        moveFocus(rows.length - 1, e.shiftKey);
        break;
      case 'a':
      case 'A':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          onSelectionChange(new Set(rows.map((r) => getRowId(r.original))));
        }
        break;
      case ' ': {
        e.preventDefault();
        const next = new Set(selectedIds);
        if (next.has(effectiveFocusedId)) next.delete(effectiveFocusedId);
        else next.add(effectiveFocusedId);
        onSelectionChange(next);
        anchorIdRef.current = effectiveFocusedId;
        break;
      }
      case 'Enter':
        e.preventDefault();
        if (currentIndex >= 0) onRowDoubleClick?.(rows[currentIndex].original);
        break;
      default:
        break;
    }
  };

  return (
    <div
      ref={containerRef}
      role="table"
      aria-multiselectable="true"
      tabIndex={0}
      onFocus={() => setIsFocusWithin(true)}
      onBlur={() => setIsFocusWithin(false)}
      onKeyDown={handleKeyDown}
      className="flex-1 overflow-auto min-h-0 outline-none"
    >
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
          const isSelected = selectedIds.has(id);
          const isFocusedRow = id === effectiveFocusedId;
          const rowElement = (
            <div
              ref={(el) => {
                if (el) rowRefs.current.set(id, el);
                else rowRefs.current.delete(id);
              }}
              role="row"
              aria-selected={isSelected}
              style={{ display: 'grid', gridTemplateColumns }}
              onClick={(e) => handleRowClick(entry, id, e)}
              onDoubleClick={() => onRowDoubleClick?.(entry)}
              onContextMenu={() => handleRowContextMenu(id)}
              className={cn(
                'hover:bg-surface-2 cursor-pointer select-none outline-none',
                isSelected && 'bg-surface-3',
                isFocusedRow && isFocusWithin && 'ring-1 ring-inset ring-accent'
              )}
            >
              {row.getVisibleCells().map((cell) => (
                <div key={cell.id} role="cell" className="p-1.5 px-3 text-xs min-w-0 truncate">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </div>
              ))}
            </div>
          );

          if (!renderContextMenu) {
            return <Fragment key={id}>{rowElement}</Fragment>;
          }

          return (
            <ContextMenu.Root key={id}>
              <ContextMenu.Trigger render={rowElement} />
              <ContextMenu.Content>
                {renderContextMenu({
                  row: entry,
                  selectedRows: isSelected ? selectedRows : [entry]
                })}
              </ContextMenu.Content>
            </ContextMenu.Root>
          );
        })}
      </div>
    </div>
  );
}
