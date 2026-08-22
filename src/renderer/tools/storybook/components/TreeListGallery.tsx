import { useState } from 'react';
import { cn } from 'cnfast';
import { File, Folder, FolderOpen, Trash2 } from 'lucide-react';
import { TreeList, type TreeItemMeta } from '@renderer/components/ui/TreeList';
import { Section } from './Section';

interface DemoNode {
  id: string;
  name: string;
  kind: 'folder' | 'file';
  children?: DemoNode[];
}

const INITIAL_DATA: DemoNode[] = [
  {
    id: 'documents',
    name: 'Documents',
    kind: 'folder',
    children: [
      {
        id: 'reports',
        name: 'Reports',
        kind: 'folder',
        children: [
          { id: 'q1', name: 'Q1.pdf', kind: 'file' },
          { id: 'q2', name: 'Q2.pdf', kind: 'file' }
        ]
      },
      { id: 'notes', name: 'Notes.md', kind: 'file' }
    ]
  },
  {
    id: 'images',
    name: 'Images',
    kind: 'folder',
    children: [
      { id: 'logo', name: 'logo.png', kind: 'file' },
      { id: 'banner', name: 'banner.png', kind: 'file' }
    ]
  },
  { id: 'readme', name: 'README.md', kind: 'file' }
];

function isNodeOrDescendant(node: DemoNode, id: string): boolean {
  if (node.id === id) return true;
  return (node.children ?? []).some((child) => isNodeOrDescendant(child, id));
}

/** Removes `nodeId` from wherever it currently sits in the tree, returning the updated tree plus the removed node. */
function removeNode(
  nodes: DemoNode[],
  nodeId: string
): { nodes: DemoNode[]; removed: DemoNode | null } {
  let removed: DemoNode | null = null;
  const next: DemoNode[] = [];
  for (const node of nodes) {
    if (node.id === nodeId) {
      removed = node;
      continue;
    }
    if (!node.children) {
      next.push(node);
      continue;
    }
    const result = removeNode(node.children, nodeId);
    if (result.removed) removed = result.removed;
    next.push({ ...node, children: result.nodes });
  }
  return { nodes: next, removed };
}

/** Inserts `node` as a child of `targetId`, or at the root when `targetId` is null. */
function insertNode(nodes: DemoNode[], targetId: string | null, node: DemoNode): DemoNode[] {
  if (targetId === null) return [...nodes, node];
  return nodes.map((n) => {
    if (n.id === targetId) return { ...n, children: [...(n.children ?? []), node] };
    if (!n.children) return n;
    return { ...n, children: insertNode(n.children, targetId, node) };
  });
}

interface DemoRowProps {
  node: DemoNode;
  meta: TreeItemMeta<DemoNode>;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

function DemoRow({ node, meta, isSelected, onSelect, onDelete }: DemoRowProps) {
  // TreeList only knows a drag is hovering this node (meta.isDropTarget) -- whether
  // it's actually a *valid* target is a domain rule (folders only, not onto its own
  // descendant), so it's decided here rather than in TreeList.
  const isValidDropTarget =
    node.kind === 'folder' &&
    meta.draggingNode !== null &&
    !isNodeOrDescendant(meta.draggingNode, node.id);

  return (
    <TreeList.Item
      meta={meta}
      onClick={() => {
        if (node.kind === 'folder') meta.toggleExpanded();
        onSelect();
      }}
      isDropTarget={meta.isDropTarget && isValidDropTarget}
      isActive={isSelected}
      className={cn(
        'gap-1.5 px-1.5 text-sm cursor-pointer select-none',
        isSelected ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
      )}
      actions={
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          title="Delete"
          className="shrink-0 text-muted-foreground opacity-0 hover:text-red-400 group-hover:opacity-100"
        >
          <Trash2 size={11} />
        </button>
      }
    >
      {node.kind === 'folder' ? (
        <TreeList.ExpandToggle hasChildren isExpanded={meta.isExpanded} />
      ) : (
        <span className="w-3 shrink-0" />
      )}
      {node.kind === 'folder' ? (
        meta.isExpanded ? (
          <FolderOpen size={13} className="shrink-0 text-amber-500" />
        ) : (
          <Folder size={13} className="shrink-0 text-amber-500" />
        )
      ) : (
        <File size={13} className="shrink-0 text-sky-500" />
      )}
      <span className="flex-1 truncate">{node.name}</span>
    </TreeList.Item>
  );
}

export function TreeListGallery() {
  const [data, setData] = useState<DemoNode[]>(INITIAL_DATA);
  const [expanded, setExpanded] = useState<Set<string>>(
    new Set(['documents', 'reports', 'images'])
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const moveNode = (draggedId: string, targetId: string | null): void => {
    setData((current) => {
      const { nodes: withoutDragged, removed } = removeNode(current, draggedId);
      if (!removed) return current;
      return insertNode(withoutDragged, targetId, removed);
    });
  };

  const deleteNode = (id: string): void => {
    setData((current) => removeNode(current, id).nodes);
  };

  return (
    <Section
      title="Tree List"
      description="Generic recursive tree: arbitrary depth, controlled expand state, drag-and-drop, and roving-focus keyboard nav (arrows, Home/End, Enter) all owned by TreeList; row content (icons, labels, actions) fully owned by renderItem. Click a row then use the arrow keys -- Right expands/steps into a folder, Left collapses/steps out, Enter activates."
    >
      <div className="w-80 rounded-md border border-border bg-surface p-2">
        <TreeList<DemoNode>
          data={data}
          getId={(n) => n.id}
          getChildren={(n) => n.children}
          expanded={expanded}
          onExpandedChange={setExpanded}
          draggable
          onDropOnNode={(dragged, target) => {
            if (target.kind !== 'folder' || isNodeOrDescendant(dragged, target.id)) return;
            moveNode(dragged.id, target.id);
          }}
          onDropOnBackground={(dragged) => moveNode(dragged.id, null)}
          onActivate={(node) => {
            if (node.kind === 'folder') return;
            setSelectedId(node.id);
          }}
          emptyState={<div className="px-1.5 py-1 text-sm italic text-muted-foreground">Empty</div>}
          renderItem={(node, meta) => (
            <DemoRow
              node={node}
              meta={meta}
              isSelected={selectedId === node.id}
              onSelect={() => setSelectedId(node.id)}
              onDelete={() => deleteNode(node.id)}
            />
          )}
        />
      </div>
    </Section>
  );
}
