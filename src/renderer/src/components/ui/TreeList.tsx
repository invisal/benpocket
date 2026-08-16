import {
  type DragEvent,
  type KeyboardEvent,
  type MouseEventHandler,
  type ReactNode,
  useRef,
  useState
} from 'react';
import { cn } from 'cnfast';
import { ChevronRight } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

export interface TreeDragHandlers {
  draggable: boolean;
  onDragStart: (e: DragEvent<HTMLDivElement>) => void;
  onDragEnd: (e: DragEvent<HTMLDivElement>) => void;
  onDragOver: (e: DragEvent<HTMLDivElement>) => void;
  onDragLeave: (e: DragEvent<HTMLDivElement>) => void;
  onDrop: (e: DragEvent<HTMLDivElement>) => void;
}

export interface TreeItemMeta<T> {
  depth: number;
  /** `depth * indent`, precomputed so callers don't each reimplement the multiplication. */
  indentPx: number;
  hasChildren: boolean;
  isExpanded: boolean;
  toggleExpanded: () => void;
  /** Whether this node is the one currently being dragged. */
  isDragging: boolean;
  /** Whether a drag is currently hovering this node -- TreeList doesn't know whether the node is a *valid* drop target, so pair this with `draggingNode` to decide whether to render it as one. */
  isDropTarget: boolean;
  /** The node currently being dragged anywhere in this tree, or null when no drag is in progress. Renderers own drop-target validity themselves (e.g. "only folders accept drops", "not onto its own descendant") by checking this against the current node. */
  draggingNode: T | null;
  /** Spread onto whatever element in the row should act as the drag source/target -- usually the row wrapper `renderItem` returns. */
  dragHandlers: TreeDragHandlers;
  /** Whether this is the roving keyboard-focus target *and* the tree's own container currently has DOM focus -- pair both so the ring doesn't show while focus is elsewhere on the page. */
  isFocused: boolean;
}

export interface TreeListProps<T> {
  data: T[];
  getId: (node: T) => string;
  /** Returns this node's children, or `undefined`/`[]` for a leaf. Not required to be a literal `children` field -- e.g. can synthesize a union of two separate arrays. */
  getChildren: (node: T) => T[] | undefined;
  expanded: Set<string>;
  onExpandedChange: (next: Set<string>) => void;
  /** Renders one node's row. Owns all content -- icon, label, badges, rename state, actions -- TreeList only supplies structural meta. */
  renderItem: (node: T, meta: TreeItemMeta<T>) => ReactNode;
  /** Px of indent per depth level, folded into `meta.indentPx`. */
  indent?: number;
  /** Enables HTML5 drag-and-drop on every row; a row still needs to spread `meta.dragHandlers` itself to become a drag source/target. */
  draggable?: boolean;
  /**
   * Fires on drop for any node a row spread `dragHandlers` onto -- TreeList doesn't
   * gate this by validity, so a no-op on an invalid `(dragged, target)` pair is on
   * the caller (same rule of thumb as `renderItem`: TreeList owns tree mechanics,
   * not domain rules about what can go where).
   */
  onDropOnNode?: (dragged: T, target: T) => void;
  /** Fires when a drag started in this tree is released over the tree's own empty background rather than on any node -- e.g. dropping to move an item back to the root. */
  onDropOnBackground?: (dragged: T) => void;
  /** Fires on Enter for the currently keyboard-focused node -- e.g. to open it, mirroring a double-click. */
  onActivate?: (node: T) => void;
  emptyState?: ReactNode;
  className?: string;
}

const NOOP_DRAG_HANDLERS: TreeDragHandlers = {
  draggable: false,
  onDragStart: () => {},
  onDragEnd: () => {},
  onDragOver: () => {},
  onDragLeave: () => {},
  onDrop: () => {}
};

interface FlatRow<T> {
  id: string;
  node: T;
  hasChildren: boolean;
  parentId: string | null;
}

function TreeListRoot<T>({
  data,
  getId,
  getChildren,
  expanded,
  onExpandedChange,
  renderItem,
  indent = 16,
  draggable = false,
  onDropOnNode,
  onDropOnBackground,
  onActivate,
  emptyState,
  className
}: TreeListProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  // Keyed by node id -- lets keyboard nav scroll a newly-focused row into view
  // without TreeList needing to know what `renderItem` actually rendered.
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // The dragged node itself (not just its id) is kept in state, rather than
  // re-derived from an id via a tree lookup, since callers need the full node
  // -- both for onDropOnNode/onDropOnBackground and for their own validity
  // checks against `meta.draggingNode` in renderItem.
  const [draggingNode, setDraggingNode] = useState<T | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [isBackgroundDropTarget, setIsBackgroundDropTarget] = useState(false);

  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [isFocusWithin, setIsFocusWithin] = useState(false);

  const toggleExpanded = (id: string): void => {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onExpandedChange(next);
  };

  // Flattens the currently *visible* rows (children of a collapsed node are
  // excluded) in display order -- the shape keyboard nav needs for
  // up/down/home/end, and for right/left to walk into or out of a node.
  // Small, non-virtualized trees only (matches TreeList's scope), so this is
  // just recomputed on every render rather than memoized.
  const flattenVisible = (nodes: T[], parentId: string | null): FlatRow<T>[] =>
    nodes.flatMap((node) => {
      const id = getId(node);
      const children = getChildren(node);
      const hasChildren = !!children && children.length > 0;
      const self: FlatRow<T> = { id, node, hasChildren, parentId };
      const visibleChildren = hasChildren && expanded.has(id) ? flattenVisible(children!, id) : [];
      return [self, ...visibleChildren];
    });

  const flatRows = flattenVisible(data, null);
  const effectiveFocusedId =
    focusedId && flatRows.some((r) => r.id === focusedId) ? focusedId : (flatRows[0]?.id ?? null);

  const moveFocusTo = (id: string | undefined): void => {
    if (!id) return;
    setFocusedId(id);
    rowRefs.current.get(id)?.scrollIntoView({ block: 'nearest' });
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
    if (flatRows.length === 0 || effectiveFocusedId === null) return;
    const currentIndex = flatRows.findIndex((r) => r.id === effectiveFocusedId);
    const current = flatRows[currentIndex];

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        moveFocusTo(flatRows[Math.min(currentIndex + 1, flatRows.length - 1)].id);
        break;
      case 'ArrowUp':
        e.preventDefault();
        moveFocusTo(flatRows[Math.max(currentIndex - 1, 0)].id);
        break;
      case 'Home':
        e.preventDefault();
        moveFocusTo(flatRows[0].id);
        break;
      case 'End':
        e.preventDefault();
        moveFocusTo(flatRows[flatRows.length - 1].id);
        break;
      case 'ArrowRight':
        e.preventDefault();
        if (!current.hasChildren) break;
        if (!expanded.has(current.id)) toggleExpanded(current.id);
        else if (flatRows[currentIndex + 1]?.parentId === current.id)
          moveFocusTo(flatRows[currentIndex + 1].id);
        break;
      case 'ArrowLeft':
        e.preventDefault();
        if (current.hasChildren && expanded.has(current.id)) toggleExpanded(current.id);
        else if (current.parentId) moveFocusTo(current.parentId);
        break;
      case 'Enter':
        e.preventDefault();
        onActivate?.(current.node);
        break;
      default:
        break;
    }
  };

  const makeDragHandlers = (node: T): TreeDragHandlers => {
    if (!draggable) return NOOP_DRAG_HANDLERS;
    const id = getId(node);
    return {
      draggable: true,
      onDragStart: (e) => {
        e.stopPropagation();
        e.dataTransfer.effectAllowed = 'move';
        setDraggingNode(node);
      },
      onDragEnd: () => {
        setDraggingNode(null);
        setDropTargetId(null);
        setIsBackgroundDropTarget(false);
      },
      onDragOver: (e) => {
        if (!draggingNode || !onDropOnNode) return;
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'move';
        setDropTargetId(id);
      },
      onDragLeave: (e) => {
        e.stopPropagation();
        setDropTargetId((current) => (current === id ? null : current));
      },
      onDrop: (e) => {
        if (!draggingNode || !onDropOnNode) return;
        e.preventDefault();
        e.stopPropagation();
        setDropTargetId(null);
        onDropOnNode(draggingNode, node);
      }
    };
  };

  const renderNode = (node: T, depth: number): ReactNode => {
    const id = getId(node);
    const children = getChildren(node);
    const hasChildren = !!children && children.length > 0;
    const isExpanded = expanded.has(id);
    const meta: TreeItemMeta<T> = {
      depth,
      indentPx: depth * indent,
      hasChildren,
      isExpanded,
      toggleExpanded: () => toggleExpanded(id),
      isDragging: draggingNode !== null && getId(draggingNode) === id,
      isDropTarget: dropTargetId === id,
      draggingNode,
      dragHandlers: makeDragHandlers(node),
      isFocused: isFocusWithin && effectiveFocusedId === id
    };
    return (
      <div key={id} className="flex flex-col">
        <div
          ref={(el) => {
            if (el) rowRefs.current.set(id, el);
            else rowRefs.current.delete(id);
          }}
          role="treeitem"
          aria-expanded={hasChildren ? isExpanded : undefined}
          aria-level={depth + 1}
          // Capture phase, so a click anywhere in the row (including on a button
          // inside it that stops bubble-phase propagation for its own onClick)
          // still syncs roving keyboard focus here -- mirrors ListView's
          // click-also-focuses behavior.
          onClickCapture={() => {
            setFocusedId(id);
            containerRef.current?.focus();
          }}
        >
          {renderItem(node, meta)}
        </div>
        {hasChildren && (
          // initial={false}: nodes that start out expanded (default state, or a
          // subtree revealed by an ancestor's own expand) shouldn't animate open
          // on first mount -- only a genuine user-driven toggle should.
          <AnimatePresence initial={false}>
            {isExpanded && (
              <motion.div
                key="children"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
                className="overflow-hidden"
              >
                <div role="group" className="flex flex-col gap-0.5">
                  {children!.map((child) => renderNode(child, depth + 1))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>
    );
  };

  return (
    <div
      ref={containerRef}
      role="tree"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onFocus={() => setIsFocusWithin(true)}
      onBlur={() => setIsFocusWithin(false)}
      className={cn(
        'flex flex-col gap-0.5 outline-none',
        isBackgroundDropTarget && 'ring-1 ring-accent bg-accent/10 rounded',
        className
      )}
      onDragOver={(e) => {
        if (!draggingNode || !onDropOnBackground) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setIsBackgroundDropTarget(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
        setIsBackgroundDropTarget(false);
      }}
      onDrop={(e) => {
        if (!draggingNode || !onDropOnBackground) return;
        e.preventDefault();
        setIsBackgroundDropTarget(false);
        onDropOnBackground(draggingNode);
      }}
    >
      {data.length === 0 ? emptyState : data.map((node) => renderNode(node, 0))}
    </div>
  );
}

function pickDragHandlers(
  handlers: TreeDragHandlers,
  mode: 'source' | 'target' | 'both' | 'none'
): Partial<TreeDragHandlers> {
  switch (mode) {
    case 'both':
      return handlers;
    case 'source':
      return {
        draggable: handlers.draggable,
        onDragStart: handlers.onDragStart,
        onDragEnd: handlers.onDragEnd
      };
    case 'target':
      return {
        onDragOver: handlers.onDragOver,
        onDragLeave: handlers.onDragLeave,
        onDrop: handlers.onDrop
      };
    case 'none':
      return {};
  }
}

export interface TreeListItemProps<T> {
  meta: TreeItemMeta<T>;
  /**
   * Which of `meta.dragHandlers` this row wires up:
   * - `'source'` -- draggable, never itself a drop target (e.g. a request).
   * - `'target'` -- a drop target, never itself draggable (e.g. a collection).
   * - `'both'` -- both at once (e.g. a folder -- draggable, and a drop target for its own children).
   * - `'none'` -- opts out of drag-and-drop entirely (e.g. an example, never dragged or dropped onto).
   * Default `'both'`.
   */
  dragMode?: 'source' | 'target' | 'both' | 'none';
  /** Shows the selected background -- this row itself backs the active tab/selection. */
  isActive?: boolean;
  /**
   * Shows the drop-target ring. TreeList only knows *something* is hovering
   * (`meta.isDropTarget`) -- domain validity (same collection, not onto its own
   * descendant, etc.) is the caller's call, so pass `meta.isDropTarget && <your validity check>`.
   */
  isDropTarget?: boolean;
  onClick?: MouseEventHandler<HTMLDivElement>;
  onDoubleClick?: MouseEventHandler<HTMLDivElement>;
  title?: string;
  className?: string;
  /** Rendered last, after `children` -- typically an `ActionsMenu`. */
  actions?: ReactNode;
  children?: ReactNode;
}

/**
 * The row shell every `TreeList` `renderItem` should wrap its content in -- owns the
 * mechanics that must stay consistent across row kinds (roving-focus ring, drag
 * opacity/drop-target ring, indent, drag-handler wiring) so individual rows only ever
 * differ in their actual content (icon, label, badges, rename state) and the `actions` slot.
 */
export function TreeListItem<T>({
  meta,
  dragMode = 'both',
  isActive,
  isDropTarget,
  onClick,
  onDoubleClick,
  title,
  className,
  actions,
  children
}: TreeListItemProps<T>) {
  return (
    <div
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      title={title}
      style={{ paddingLeft: meta.indentPx }}
      {...pickDragHandlers(meta.dragHandlers, dragMode)}
      className={cn(
        'h-7 flex items-center gap-2 px-2 rounded transition-all group',
        meta.isDragging && 'opacity-40',
        isDropTarget && 'ring-1 ring-accent bg-accent/10',
        // Hover/keyboard-focus only apply when the row isn't already selected --
        // otherwise a mouse-over (or roving focus landing on it) would repaint a
        // selected row's background back to the plain hover color, making hover
        // read as if it outranks selection.
        isActive
          ? 'bg-list-selected'
          : cn('hover:bg-list-hover', meta.isFocused && 'bg-list-hover'),
        className
      )}
    >
      {children}
      {actions}
    </div>
  );
}

export interface TreeListExpandToggleProps {
  hasChildren: boolean;
  isExpanded: boolean;
  /**
   * When there's nothing to expand, render a same-width blank spacer instead of
   * nothing, so sibling rows' labels still line up. Default `true` -- turn off for
   * a toggle that isn't the row's leading element (e.g. nested further into the
   * row, where non-expandable siblings don't need to align against it).
   */
  reserveSpace?: boolean;
  size?: number;
  className?: string;
}

/** The chevron-or-spacer every expandable row's leading slot renders -- rotates open, or reserves its own width so leaf rows still align with expandable ones. */
export function TreeListExpandToggle({
  hasChildren,
  isExpanded,
  reserveSpace = true,
  size = 12,
  className
}: TreeListExpandToggleProps) {
  if (!hasChildren) {
    return reserveSpace ? <span className="shrink-0" style={{ width: size }} /> : null;
  }
  return (
    <ChevronRight
      size={size}
      className={cn(
        'shrink-0 text-zinc-500 transition-transform duration-150',
        isExpanded && 'rotate-90',
        className
      )}
    />
  );
}

export const TreeList = Object.assign(TreeListRoot, {
  Item: TreeListItem,
  ExpandToggle: TreeListExpandToggle
});
