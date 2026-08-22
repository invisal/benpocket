import { useContext } from 'react';
import { Folder, FolderOpen } from 'lucide-react';
import { TreeList, type TreeItemMeta } from '@renderer/components/ui/TreeList';
import { compareEntries, type FileEntry } from '../../file-explorer/components/columns';
import { ExtensionIcon } from '../../file-explorer/components/ExtensionIcon';
import { useWorkspaceStore, WorkspaceStoreContext } from '../store/workspace.store';
import { useWorkspaceTreeData } from '../lib/useWorkspaceTreeData';

type WorkspaceTreeNode = FileEntry & { isPlaceholder?: boolean };

function placeholderNode(parentPath: string): WorkspaceTreeNode {
  return {
    name: 'Loading…',
    path: `${parentPath} __placeholder__`,
    isDirectory: false,
    size: 0,
    modifiedMs: 0,
    extension: '',
    isPlaceholder: true
  };
}

interface WorkspaceTreeProps {
  previewFile: string | null;
  onSelectFile: (path: string) => void;
}

export function WorkspaceTree({ previewFile, onSelectFile }: WorkspaceTreeProps) {
  const store = useContext(WorkspaceStoreContext);
  if (!store) {
    throw new Error('WorkspaceTree must be used within a WorkspaceStoreContext.Provider');
  }
  useWorkspaceTreeData(store);

  const rootPath = useWorkspaceStore((s) => s.rootPath);
  const expanded = useWorkspaceStore((s) => s.expanded);
  const setExpanded = useWorkspaceStore((s) => s.setExpanded);
  const childrenByPath = useWorkspaceStore((s) => s.childrenByPath);

  const getChildren = (node: WorkspaceTreeNode): WorkspaceTreeNode[] | undefined => {
    if (node.isPlaceholder || !node.isDirectory) return undefined;
    const loaded = childrenByPath[node.path];
    if (loaded === undefined) return [placeholderNode(node.path)];
    return [...loaded].sort(compareEntries);
  };

  const handleRowClick = (node: WorkspaceTreeNode, meta: TreeItemMeta<WorkspaceTreeNode>) => {
    if (node.isPlaceholder) return;
    if (node.isDirectory) meta.toggleExpanded();
    else onSelectFile(node.path);
  };

  // rootPath itself isn't rendered as a row -- the tree starts from its
  // children, so `expanded` only ever needs rootPath in it to trigger the
  // initial fetch (see workspace.store's default expanded state).
  const rootChildren = childrenByPath[rootPath];
  const data: WorkspaceTreeNode[] =
    rootChildren === undefined
      ? [placeholderNode(rootPath)]
      : [...rootChildren].sort(compareEntries);

  return (
    <TreeList
      data={data}
      getId={(node) => node.path}
      getChildren={getChildren}
      expanded={expanded}
      onExpandedChange={setExpanded}
      className="p-2"
      renderItem={(node, meta) => (
        <TreeList.Item
          meta={meta}
          dragMode="none"
          isActive={!node.isPlaceholder && node.path === previewFile}
          onClick={() => handleRowClick(node, meta)}
          title={node.isPlaceholder ? undefined : node.path}
        >
          {!node.isPlaceholder && (
            <TreeList.ExpandToggle hasChildren={meta.hasChildren} isExpanded={meta.isExpanded} />
          )}
          {node.isPlaceholder ? (
            <span className="pl-[14px] text-sm italic text-text-dim">Loading…</span>
          ) : (
            <>
              {node.isDirectory ? (
                meta.isExpanded ? (
                  <FolderOpen size={14} className="shrink-0 text-zinc-500" />
                ) : (
                  <Folder size={14} className="shrink-0 text-zinc-500" />
                )
              ) : (
                <ExtensionIcon
                  extension={node.extension}
                  className="size-3.5 shrink-0 text-zinc-500"
                />
              )}
              <span className="truncate text-sm">{node.name}</span>
            </>
          )}
        </TreeList.Item>
      )}
    />
  );
}
