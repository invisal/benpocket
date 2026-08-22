import { useEffect } from 'react';
import { type FileEntry } from '../../file-explorer/components/columns';
import { type WorkspaceStore } from '../store/workspace.store';

/**
 * Lazily fills `childrenByPath` for every directory the tree currently has
 * expanded. `TreeList` needs `getChildren` to return synchronously, so
 * `WorkspaceTree` renders a placeholder row for a directory until this
 * effect's fetch resolves and writes the real listing into the store.
 */
export function useWorkspaceTreeData(store: WorkspaceStore): void {
  const expanded = store((s) => s.expanded);
  const childrenByPath = store((s) => s.childrenByPath);
  const refreshSignal = store((s) => s.refreshSignal);

  useEffect(() => {
    const { setChildren } = store.getState();
    const pending = [...expanded].filter((path) => childrenByPath[path] === undefined);
    if (pending.length === 0) return;

    let cancelled = false;
    pending.forEach(async (path) => {
      const accumulated: FileEntry[] = [];
      let cursor: string | undefined;
      for (;;) {
        const res = await window.fileExplorer.listDirectory(path, cursor);
        if (cancelled) return;
        if ('error' in res) return;
        accumulated.push(...res.entries);
        if (res.nextCursor === null) break;
        cursor = res.nextCursor;
      }
      if (!cancelled) setChildren(path, accumulated);
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded, refreshSignal]);
}
