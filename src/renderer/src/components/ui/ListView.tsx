import {
  type DragEvent,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import { flexRender, type Table } from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { cn } from 'cnfast';
import { ContextMenu } from './ContextMenu';

// Virtualization requires every row to report the same height up front
// (no per-row measurement), so this must match the actual rendered row
// height below (row cell padding + line height).
const ROW_HEIGHT = 28;

// How long to wait after the last keypress before the accumulated
// type-ahead search query resets (classic Explorer/Finder timing).
const TYPEAHEAD_RESET_MS = 300;

interface ListViewContextMenuArgs<TData> {
  /** null when the right-click landed on background rather than a row (empty folder, or space below the last row). */
  row: TData | null;
  selectedRows: TData[];
}

interface ListViewProps<TData> {
  table: Table<TData>;
  getRowId: (row: TData) => string;
  /**
   * Extracts a searchable label from a row, enabling type-ahead:
   * pressing a printable key jumps focus/selection to the first row whose
   * label starts with what's typed (Explorer/Finder-style). Omit this prop
   * to disable type-ahead entirely -- unmodified letter/digit keypresses
   * remain a no-op, same as today.
   */
  getRowLabel?: (row: TData) => string;
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  onRowClick?: (row: TData) => void;
  onRowDoubleClick?: (row: TData) => void;
  renderContextMenu?: (args: ListViewContextMenuArgs<TData>) => ReactNode;
  emptyState?: ReactNode;
  rowHeight?: number;
  onCopy?: () => void;
  onCut?: () => void;
  onPaste?: () => void;
  onDelete?: () => void;
  /**
   * Enables HTML5 drag-and-drop of rows. `draggedRows` is the full set being
   * dragged: the current selection if `row` is part of it, otherwise just
   * `row` alone (dragging a row that isn't selected drags only that row,
   * matching the right-click-to-select behavior in handleContextMenuOpen).
   */
  onRowDragStart?: (row: TData, draggedRows: TData[], e: DragEvent<HTMLDivElement>) => void;
  /** MIME type set by onRowDragStart, used to ignore drags this list didn't originate (e.g. dragged text). */
  dragMimeType?: string;
  /** Whether `row` can accept a drop -- rows for which this returns false fall through to onDropBackground instead. */
  canDropOnRow?: (row: TData) => boolean;
  onDropOnRow?: (row: TData, e: DragEvent<HTMLDivElement>) => void;
  /** Fires for drops that don't land on a valid row target (empty space, a non-drop-target row). */
  onDropBackground?: (e: DragEvent<HTMLDivElement>) => void;
}

export function ListView<TData>({
  table,
  getRowId,
  getRowLabel,
  selectedIds,
  onSelectionChange,
  onRowClick,
  onRowDoubleClick,
  renderContextMenu,
  emptyState,
  rowHeight = ROW_HEIGHT,
  onCopy,
  onCut,
  onPaste,
  onDelete,
  onRowDragStart,
  dragMimeType,
  canDropOnRow,
  onDropOnRow,
  onDropBackground
}: ListViewProps<TData>) {
  const rows = table.getRowModel().rows;
  const containerRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const anchorIdRef = useRef<string | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [isFocusWithin, setIsFocusWithin] = useState(false);
  // Which row (if any) the context menu was opened on -- null means the click
  // landed on background (empty folder, or space below the last row).
  const [contextRowId, setContextRowId] = useState<string | null>(null);
  // The header is sticky *inside* the scrollable container rather than
  // outside it, so it permanently overlaps the top of the viewport once
  // scrolled. The virtualizer needs its height (as scrollMargin/
  // scrollPaddingStart) to keep rows from landing underneath it.
  const [headerHeight, setHeaderHeight] = useState(0);

  // Ids currently being dragged (set on this row's own dragstart, not a
  // cross-window drag originating elsewhere) -- used to dim the dragged rows
  // and to refuse dropping a row onto itself/its own selection.
  const [draggingIds, setDraggingIds] = useState<Set<string> | null>(null);
  const [dragOverRowId, setDragOverRowId] = useState<string | null>(null);
  const [dragOverBackground, setDragOverBackground] = useState(false);

  useLayoutEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      setHeaderHeight(entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Holding an arrow key fires keydown repeats faster than a full
  // state-update + scroll + render cycle can paint, so events queue up and
  // several index-advances would land in one frame. Coalesce them into a
  // single move applied once per animation frame instead.
  const pendingMoveRef = useRef<{ baseIndex: number; delta: number; extend: boolean } | null>(null);
  const rafIdRef = useRef<number | null>(null);

  // Buffers consecutive printable keypresses into a search query for
  // type-ahead jump-to-item. Repeating the *same* single character (e.g.
  // mashing "s") doesn't grow the query to "sss" (which would rarely match
  // anything) -- it instead cycles forward through every row starting with
  // "s". Typing different characters within TYPEAHEAD_RESET_MS grows a
  // multi-char prefix (e.g. "d" then "o" -> searches for names starting
  // with "do").
  const typeaheadQueryRef = useRef('');
  const typeaheadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current);
      if (typeaheadTimeoutRef.current !== null) clearTimeout(typeaheadTimeoutRef.current);
    };
  }, []);

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Virtual memoizes its own return value; not a React Compiler concern
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => rowHeight,
    overscan: 16,
    scrollMargin: headerHeight,
    scrollPaddingStart: headerHeight
  });

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

  const contextRow = useMemo(() => {
    if (!contextRowId) return null;
    return rows.find((r) => getRowId(r.original) === contextRowId)?.original ?? null;
  }, [rows, contextRowId, getRowId]);

  // Falls back to just the right-clicked row when it wasn't already part of
  // the selection, matching how a single click elsewhere would re-anchor it.
  const contextMenuSelectedRows =
    contextRow && contextRowId && !selectedIds.has(contextRowId) ? [contextRow] : selectedRows;

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
    rowVirtualizer.scrollToIndex(clamped, { align: 'auto' });
    if (extend && anchorIdRef.current) {
      onSelectionChange(idsInRange(anchorIdRef.current, id));
    } else {
      onSelectionChange(new Set([id]));
      anchorIdRef.current = id;
    }
  };

  // Resolves the type-ahead query for a newly typed character and returns
  // the row index to jump to, or -1 if nothing matches. Mutates
  // typeaheadQueryRef/typeaheadTimeoutRef as a side effect (query buffering
  // + reset timer) -- callers just act on the returned index.
  const resolveTypeaheadMatch = (key: string, currentIndex: number): number => {
    if (!getRowLabel) return -1;

    // toLocaleLowerCase (not toLowerCase) so case-folding respects the
    // user's locale (e.g. Turkish dotted/dotless I). This does not do
    // accent-folding (e.g. "e" won't match "é") -- unlike the list's sort
    // order, which uses localeCompare with sensitivity: 'base'. Matching
    // and sort-ordering are different concerns; Explorer/Finder's own
    // type-ahead has the same limitation.
    const typedChar = key.toLocaleLowerCase();
    const prevQuery = typeaheadQueryRef.current;
    const isRepeatOfSameKey =
      prevQuery.length > 0 && prevQuery === typedChar.repeat(prevQuery.length);

    const query = isRepeatOfSameKey ? prevQuery : prevQuery + typedChar;
    typeaheadQueryRef.current = query;

    if (typeaheadTimeoutRef.current !== null) clearTimeout(typeaheadTimeoutRef.current);
    typeaheadTimeoutRef.current = setTimeout(() => {
      typeaheadQueryRef.current = '';
      typeaheadTimeoutRef.current = null;
    }, TYPEAHEAD_RESET_MS);

    if (isRepeatOfSameKey) {
      // Cycle forward from just past the current row, wrapping around, so
      // repeated presses advance through every match and wrap back to the
      // first after the last.
      for (let offset = 1; offset <= rows.length; offset++) {
        const index = (currentIndex + offset) % rows.length;
        if (getRowLabel(rows[index].original).toLocaleLowerCase().startsWith(query)) return index;
      }
      return -1;
    }

    // Fresh/growing query: always search from the top, not from the
    // current position -- the list is already meaningfully sorted
    // (dirs-first/alphabetical), so "first match from the top" is the
    // predictable, expected result rather than depending on where focus
    // currently is.
    return rows.findIndex((r) => getRowLabel(r.original).toLocaleLowerCase().startsWith(query));
  };

  const cancelPendingMove = () => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    pendingMoveRef.current = null;
  };

  const flushPendingMove = () => {
    rafIdRef.current = null;
    const pending = pendingMoveRef.current;
    if (!pending) return;
    pendingMoveRef.current = null;
    moveFocus(pending.baseIndex + pending.delta, pending.extend);
  };

  const queueMoveFocus = (currentIndex: number, direction: 1 | -1, extend: boolean) => {
    if (pendingMoveRef.current) {
      pendingMoveRef.current.delta += direction;
      pendingMoveRef.current.extend = extend;
    } else {
      pendingMoveRef.current = { baseIndex: currentIndex, delta: direction, extend };
    }
    if (rafIdRef.current === null) {
      rafIdRef.current = requestAnimationFrame(flushPendingMove);
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

  // A native OS drag (e.g. a row handed off to Electron's webContents.startDrag
  // for dragging out to Explorer/Finder) carries a real 'Files' type instead of
  // the list's own custom mime type -- accept it too, so a drag that re-enters
  // this app (another pane, or the same list) still lands as a valid drop
  // rather than being treated as a foreign drag.
  const isForeignDrag = (e: DragEvent<HTMLDivElement>) =>
    dragMimeType !== undefined &&
    !e.dataTransfer.types.includes(dragMimeType) &&
    !e.dataTransfer.types.includes('Files');

  const handleRowDragStart = (entry: TData, id: string, e: DragEvent<HTMLDivElement>) => {
    const draggedIds = selectedIds.has(id) ? selectedIds : new Set([id]);
    if (!selectedIds.has(id)) {
      onSelectionChange(draggedIds);
      anchorIdRef.current = id;
    }
    const draggedRows = rows
      .filter((r) => draggedIds.has(getRowId(r.original)))
      .map((r) => r.original);
    onRowDragStart?.(entry, draggedRows, e);
    // A drag handed off to a native OS drag (dragstart preventDefault()'d) never
    // fires dragend on this element -- that's a separate, OS-brokered session
    // now, not a DOM drag -- so skip the dimming state instead of leaving the
    // row stuck dimmed with no event left to clear it.
    if (!e.defaultPrevented) setDraggingIds(draggedIds);
  };

  const handleRowDragEnd = () => {
    setDraggingIds(null);
    setDragOverRowId(null);
    setDragOverBackground(false);
  };

  const handleRowDragOver = (entry: TData, id: string, e: DragEvent<HTMLDivElement>) => {
    if (!onDropOnRow || !canDropOnRow?.(entry) || draggingIds?.has(id) || isForeignDrag(e)) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
    setDragOverRowId(id);
  };

  const handleRowDragLeave = (id: string) => {
    setDragOverRowId((current) => (current === id ? null : current));
  };

  const handleRowDrop = (entry: TData, id: string, e: DragEvent<HTMLDivElement>) => {
    if (!onDropOnRow || !canDropOnRow?.(entry) || draggingIds?.has(id) || isForeignDrag(e)) return;
    e.preventDefault();
    e.stopPropagation();
    setDragOverRowId(null);
    onDropOnRow(entry, e);
  };

  const handleBackgroundDragOver = (e: DragEvent<HTMLDivElement>) => {
    if (!onDropBackground || isForeignDrag(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setDragOverBackground(true);
  };

  const handleBackgroundDragLeave = (e: DragEvent<HTMLDivElement>) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setDragOverBackground(false);
  };

  const handleBackgroundDrop = (e: DragEvent<HTMLDivElement>) => {
    if (!onDropBackground || isForeignDrag(e)) return;
    e.preventDefault();
    setDragOverBackground(false);
    onDropBackground(e);
  };

  // Single handler for the whole list area (see the container's onContextMenu
  // below) rather than one per row -- it looks at the event target to figure
  // out whether a row or the background was right-clicked.
  const handleContextMenuOpen = (e: MouseEvent<HTMLDivElement>) => {
    const rowElement = (e.target as HTMLElement).closest<HTMLElement>('[data-row-id]');
    const id = rowElement?.dataset.rowId ?? null;
    containerRef.current?.focus();
    setContextRowId(id);
    if (id) {
      if (!selectedIds.has(id)) {
        onSelectionChange(new Set([id]));
        anchorIdRef.current = id;
      }
      setFocusedId(id);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const mod = e.ctrlKey || e.metaKey;
    // Paste doesn't depend on there being any rows/focus (e.g. pasting into an
    // empty folder), so it's handled before the rows-empty guard below.
    if (mod && (e.key === 'v' || e.key === 'V') && onPaste) {
      e.preventDefault();
      onPaste();
      return;
    }

    if (rows.length === 0 || effectiveFocusedId === null) return;
    const currentIndex = rows.findIndex((r) => getRowId(r.original) === effectiveFocusedId);

    // Type-ahead must be checked before the switch: unmodified 'c'/'x'/'a'
    // already have dedicated case labels below (for their mod+key
    // shortcuts), so an unmodified press of one of those letters would hit
    // its case, find `mod` false, and `break` without ever reaching
    // `default` -- silently swallowing the letter instead of jumping to
    // it. Checking here intercepts all unmodified single-character keys up
    // front, while modifier-held presses still fall through to the switch
    // below for copy/cut/select-all. ' ' is explicitly excluded so it
    // keeps its existing "toggle selection of focused row" behavior.
    if (getRowLabel && !mod && !e.altKey && e.key.length === 1 && e.key !== ' ') {
      e.preventDefault();
      cancelPendingMove();
      const matchIndex = resolveTypeaheadMatch(e.key, currentIndex);
      if (matchIndex >= 0) moveFocus(matchIndex, false);
      return;
    }

    switch (e.key) {
      case 'c':
      case 'C':
        if (mod && onCopy) {
          e.preventDefault();
          onCopy();
        }
        break;
      case 'x':
      case 'X':
        if (mod && onCut) {
          e.preventDefault();
          onCut();
        }
        break;
      case 'Delete':
        if (onDelete) {
          e.preventDefault();
          onDelete();
        }
        break;
      case 'ArrowDown':
        e.preventDefault();
        queueMoveFocus(currentIndex, 1, e.shiftKey);
        break;
      case 'ArrowUp':
        e.preventDefault();
        queueMoveFocus(currentIndex, -1, e.shiftKey);
        break;
      case 'Home':
        e.preventDefault();
        cancelPendingMove();
        moveFocus(0, e.shiftKey);
        break;
      case 'End':
        e.preventDefault();
        cancelPendingMove();
        moveFocus(rows.length - 1, e.shiftKey);
        break;
      case 'a':
      case 'A':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          cancelPendingMove();
          onSelectionChange(new Set(rows.map((r) => getRowId(r.original))));
        }
        break;
      case ' ': {
        e.preventDefault();
        cancelPendingMove();
        const next = new Set(selectedIds);
        if (next.has(effectiveFocusedId)) next.delete(effectiveFocusedId);
        else next.add(effectiveFocusedId);
        onSelectionChange(next);
        anchorIdRef.current = effectiveFocusedId;
        break;
      }
      case 'Enter':
        e.preventDefault();
        cancelPendingMove();
        if (currentIndex >= 0) onRowDoubleClick?.(rows[currentIndex].original);
        break;
      default:
        break;
    }
  };

  const containerElement = (
    <div
      ref={containerRef}
      role="table"
      aria-multiselectable="true"
      tabIndex={0}
      onFocus={() => setIsFocusWithin(true)}
      onBlur={() => setIsFocusWithin(false)}
      onKeyDown={handleKeyDown}
      onContextMenu={handleContextMenuOpen}
      onDragOver={handleBackgroundDragOver}
      onDragLeave={handleBackgroundDragLeave}
      onDrop={handleBackgroundDrop}
      className={cn(
        'flex-1 overflow-auto min-h-0 outline-none',
        rows.length === 0 && emptyState && 'flex flex-col',
        dragOverBackground && 'bg-accent/5'
      )}
    >
      <div ref={headerRef} role="rowgroup" className="sticky top-0 z-10">
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
      {rows.length === 0 && emptyState ? (
        emptyState
      ) : (
        <div
          role="rowgroup"
          style={{
            position: 'relative',
            height: `${rowVirtualizer.getTotalSize() - headerHeight}px`
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const row = rows[virtualRow.index];
            const entry = row.original;
            const id = getRowId(entry);
            const isSelected = selectedIds.has(id);
            const isFocusedRow = id === effectiveFocusedId;
            return (
              <div
                key={id}
                role="row"
                aria-selected={isSelected}
                data-row-id={id}
                style={{
                  display: 'grid',
                  gridTemplateColumns,
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start - headerHeight}px)`
                }}
                // Chromium won't fire dragstart on a draggable element whose
                // mousedown was preventDefault()'d, so skip it when dragging
                // is enabled -- text selection is already blocked by the
                // select-none class below.
                onMouseDown={(e) => {
                  if (!onRowDragStart) e.preventDefault();
                }}
                onClick={(e) => handleRowClick(entry, id, e)}
                onDoubleClick={() => onRowDoubleClick?.(entry)}
                draggable={!!onRowDragStart}
                onDragStart={(e) => handleRowDragStart(entry, id, e)}
                onDragEnd={handleRowDragEnd}
                onDragOver={(e) => handleRowDragOver(entry, id, e)}
                onDragLeave={() => handleRowDragLeave(id)}
                onDrop={(e) => handleRowDrop(entry, id, e)}
                className={cn(
                  'hover:bg-surface-2 cursor-pointer select-none outline-none',
                  isSelected && 'bg-surface-3',
                  isFocusedRow && isFocusWithin && 'ring-1 ring-inset ring-accent',
                  draggingIds?.has(id) && 'opacity-40',
                  dragOverRowId === id && 'ring-1 ring-inset ring-accent bg-accent/10'
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
      )}
    </div>
  );

  if (!renderContextMenu) return containerElement;

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger render={containerElement} />
      <ContextMenu.Content>
        {renderContextMenu({ row: contextRow, selectedRows: contextMenuSelectedRows })}
      </ContextMenu.Content>
    </ContextMenu.Root>
  );
}
