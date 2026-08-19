import type React from 'react';
import { useState } from 'react';
import { Popover } from '@base-ui/react/popover';
import { ChevronDown, FolderOpen, Pencil, Plus, Trash2 } from 'lucide-react';
import { useWorkspacesStore } from '../store/workspaces.store';
import { useCollectionsStore } from '../store/collections.store';
import { useEnvironmentsStore } from '../store/environments.store';
import { nativeSelectClassName } from '../lib/nativeSelectClassName';
import { countRequestsRecursive } from '../lib/collectionTree';
import { DeleteConfirmDialog } from './DeleteConfirmDialog';

export const WorkspaceSelector: React.FC = () => {
  const {
    workspaces,
    activeWorkspaceId,
    setActiveWorkspaceId,
    createWorkspace,
    renameWorkspace,
    deleteWorkspace
  } = useWorkspacesStore();
  const collections = useCollectionsStore((s) => s.collections);
  const environments = useEnvironmentsStore((s) => s.environments);

  const [open, setOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameDraft, setRenameDraft] = useState('');
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId) ?? null;
  const canDelete = workspaces.length > 1;

  const submitNewWorkspace = async (): Promise<void> => {
    const name = draftName.trim();
    setIsCreating(false);
    setDraftName('');
    if (!name) return;
    try {
      await createWorkspace(name);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    }
  };

  const submitRename = async (): Promise<void> => {
    setIsRenaming(false);
    const trimmed = renameDraft.trim();
    if (!activeWorkspace || !trimmed || trimmed === activeWorkspace.name) return;
    try {
      await renameWorkspace(activeWorkspace.id, trimmed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    }
  };

  const confirmDelete = async (): Promise<void> => {
    setIsConfirmingDelete(false);
    if (!activeWorkspace || !canDelete) return;
    try {
      await deleteWorkspace(activeWorkspace.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    }
  };

  const workspaceCascade = ((): string | undefined => {
    if (!activeWorkspace) return undefined;
    const collectionCount = collections.filter((c) => c.workspaceId === activeWorkspace.id).length;
    const requestCount = collections
      .filter((c) => c.workspaceId === activeWorkspace.id)
      .reduce((sum, c) => sum + countRequestsRecursive(c), 0);
    const environmentCount = environments.filter(
      (e) => e.workspaceId === activeWorkspace.id
    ).length;
    const parts = [
      collectionCount > 0
        ? `${collectionCount} collection${collectionCount === 1 ? '' : 's'} (${requestCount} request${requestCount === 1 ? '' : 's'})`
        : null,
      environmentCount > 0
        ? `${environmentCount} environment${environmentCount === 1 ? '' : 's'}`
        : null
    ].filter((p): p is string => p !== null);
    return parts.length > 0 ? parts.join(' and ') : undefined;
  })();

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setError(null);
      }}
    >
      <Popover.Trigger className="flex items-center gap-1.5 min-w-0 cursor-pointer text-left outline-none">
        <FolderOpen size={13} className="text-accent shrink-0" />
        <span className="truncate text-[10px] font-bold tracking-wider text-zinc-300 uppercase hover:text-foreground">
          {activeWorkspace?.name ?? 'Select Workspace'}
        </span>
        <ChevronDown size={11} className="text-zinc-500 shrink-0" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={8} align="start" className="z-50">
          <Popover.Popup className="bg-surface border border-border-dark rounded-lg shadow-xl p-3 w-72 flex flex-col gap-3 text-xs outline-none">
            <div className="flex items-center justify-between">
              <span className="font-bold text-zinc-300 uppercase tracking-wider text-[10px]">
                Workspace
              </span>
              <button
                onClick={() => {
                  setIsCreating(true);
                  setDraftName('');
                }}
                title="New Workspace"
                className="p-1 text-zinc-500 hover:text-foreground hover:bg-border-dark/60 rounded cursor-pointer"
              >
                <Plus size={13} />
              </button>
            </div>

            {isCreating && (
              <input
                type="text"
                autoFocus
                placeholder="Workspace name..."
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                onBlur={submitNewWorkspace}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submitNewWorkspace();
                  if (e.key === 'Escape') {
                    setIsCreating(false);
                    setDraftName('');
                  }
                }}
                className="bg-surface-2 border border-accent rounded px-2 py-1.5 text-zinc-200 focus:outline-none"
              />
            )}

            <select
              value={activeWorkspaceId ?? ''}
              onChange={(e) => setActiveWorkspaceId(e.target.value)}
              className={nativeSelectClassName()}
            >
              {workspaces.map((ws) => (
                <option key={ws.id} value={ws.id}>
                  {ws.name}
                </option>
              ))}
            </select>

            {activeWorkspace && (
              <div className="flex items-center justify-between border-t border-border pt-2">
                {isRenaming ? (
                  <input
                    type="text"
                    autoFocus
                    value={renameDraft}
                    onChange={(e) => setRenameDraft(e.target.value)}
                    onBlur={submitRename}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') submitRename();
                      if (e.key === 'Escape') setIsRenaming(false);
                    }}
                    className="flex-1 bg-surface-2 border border-accent rounded px-1.5 py-0.5 text-zinc-200 focus:outline-none"
                  />
                ) : (
                  <span className="text-zinc-400 font-semibold truncate">
                    {activeWorkspace.name}
                  </span>
                )}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => {
                      setRenameDraft(activeWorkspace.name);
                      setIsRenaming(true);
                    }}
                    title="Rename workspace"
                    className="p-0.5 text-zinc-555 hover:text-foreground cursor-pointer"
                  >
                    <Pencil size={11} />
                  </button>
                  <button
                    onClick={() => setIsConfirmingDelete(true)}
                    disabled={!canDelete}
                    title={canDelete ? 'Delete workspace' : "Can't delete the last workspace"}
                    className="p-0.5 text-zinc-555 hover:text-red-400 disabled:opacity-30 disabled:hover:text-zinc-555 disabled:cursor-default cursor-pointer"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>
            )}

            {workspaces.length <= 1 && (
              <p className="text-[10px] text-zinc-600 leading-relaxed">
                Workspaces keep collections and environments completely separate - use more than one
                to split, say, personal and work APIs.
              </p>
            )}

            {error && <p className="text-[10px] text-red-400 leading-relaxed">{error}</p>}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>

      <DeleteConfirmDialog
        target={
          isConfirmingDelete && activeWorkspace
            ? { kind: 'workspace', name: activeWorkspace.name, cascade: workspaceCascade }
            : null
        }
        onConfirm={confirmDelete}
        onCancel={() => setIsConfirmingDelete(false)}
      />
    </Popover.Root>
  );
};
