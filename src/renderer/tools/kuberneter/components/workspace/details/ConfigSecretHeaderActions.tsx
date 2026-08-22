import { useState, useCallback, type FC } from 'react';
import { Pencil, Trash2, AlertTriangle, Loader2 } from 'lucide-react';
import { Tooltip } from '@renderer/components/ui/Tooltip';
import { Dialog } from '@renderer/components/ui/Dialog';
import { useQueryClient } from '@tanstack/react-query';
import { useKuberneterStore } from '../../../store/kuberneter.store';
import { useLayoutStore } from '../../../../../src/store/layout.store';
import type { KubernetesObject } from '@kubernetes/client-node';

interface ConfigSecretHeaderActionsProps {
  contentType: string;
  payload: unknown;
}

export const ConfigSecretHeaderActions: FC<ConfigSecretHeaderActionsProps> = ({
  contentType,
  payload
}) => {
  const queryClient = useQueryClient();
  const activeInstanceId = useLayoutStore((s) => s.activeInstanceId);
  const activeTabId = useLayoutStore((s) => s.activeTabId);
  const closeTab = useLayoutStore((s) => s.closeTab);
  const cluster = useKuberneterStore((s) => s.kuberneterInstanceCluster[activeInstanceId] || '');
  const rawConfigPath = useKuberneterStore(
    (s) => s.kuberneterInstanceConfigPath[activeInstanceId] || 'default'
  );
  const openResourceEditTab = useKuberneterStore((s) => s.openResourceEditTab);
  const setDrawerState = useKuberneterStore((s) => s.setKuberneterTabDrawerState);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const isSecret = contentType.toLowerCase().includes('secret');
  const kind = isSecret ? 'Secret' : 'ConfigMap';
  const resourceKey = isSecret ? 'secrets' : 'configmaps';

  const obj = (payload || {}) as KubernetesObject;
  const name =
    obj.metadata?.name ||
    (payload as { name?: string })?.name ||
    (payload as { metadata?: { name?: string } })?.metadata?.name ||
    '';
  const namespace =
    obj.metadata?.namespace ||
    (payload as { ns?: string })?.ns ||
    (payload as { metadata?: { namespace?: string } })?.metadata?.namespace;

  const handleEdit = useCallback(() => {
    if (name) {
      openResourceEditTab(resourceKey, name, namespace, payload);
    }
  }, [name, openResourceEditTab, resourceKey, namespace, payload]);

  const handleDelete = useCallback(async () => {
    if (!name) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const configPathArg = rawConfigPath === 'default' ? undefined : rawConfigPath;
      const res = await window.kuberneter.deleteResource(
        configPathArg,
        cluster,
        resourceKey,
        name,
        namespace
      );

      if (res.success) {
        useKuberneterStore.getState().addToast({
          type: 'info',
          title: `${kind} Deleted`,
          message: `${kind} "${name}" was deleted successfully.`
        });
        setDeleteDialogOpen(false);

        // Invalidate queries so lists refresh immediately
        queryClient.invalidateQueries({ queryKey: ['kuberneter'] });

        // Close drawer if open
        if (activeTabId) {
          setDrawerState(activeTabId, { isOpen: false });
        }

        // Close detail tab if active
        if (
          activeTabId &&
          (activeTabId.includes(`${resourceKey}-detail`) ||
            activeTabId.includes(`${kind.toLowerCase()}-detail`))
        ) {
          closeTab(activeTabId);
        }
      } else {
        setDeleteError(res.error || 'Failed to delete resource.');
      }
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsDeleting(false);
    }
  }, [
    name,
    rawConfigPath,
    cluster,
    resourceKey,
    namespace,
    kind,
    queryClient,
    activeTabId,
    setDrawerState,
    closeTab
  ]);

  return (
    <>
      <Tooltip.Provider delay={200} closeDelay={0}>
        {/* Edit Button */}
        <Tooltip.Root>
          <Tooltip.Trigger
            render={
              <button
                type="button"
                onClick={handleEdit}
                title="Edit YAML"
                className="text-zinc-400 hover:text-strong cursor-pointer hover:bg-border-dark/40 p-1 rounded transition-colors border-none bg-transparent flex items-center justify-center"
              >
                <Pencil className="size-3.5" />
              </button>
            }
          />
          <Tooltip.Content side="bottom">Edit YAML</Tooltip.Content>
        </Tooltip.Root>

        {/* Delete Button */}
        <Tooltip.Root>
          <Tooltip.Trigger
            render={
              <button
                type="button"
                onClick={() => {
                  setDeleteError(null);
                  setDeleteDialogOpen(true);
                }}
                title={`Delete ${kind}`}
                className="text-zinc-400 hover:text-rose-400 cursor-pointer hover:bg-border-dark/40 p-1 rounded transition-colors border-none bg-transparent flex items-center justify-center"
              >
                <Trash2 className="size-3.5" />
              </button>
            }
          />
          <Tooltip.Content side="bottom">Delete</Tooltip.Content>
        </Tooltip.Root>
      </Tooltip.Provider>

      {/* Delete Confirmation Dialog */}
      <Dialog.Root open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <Dialog.Content className="max-w-sm">
          <Dialog.Title className="flex items-center gap-2 text-rose-500">
            <AlertTriangle className="size-4 text-rose-500 shrink-0" />
            <span>Delete {kind}</span>
          </Dialog.Title>
          <Dialog.Description className="mt-2 text-xs leading-relaxed text-muted-foreground">
            Are you sure you want to delete {kind} <b className="text-foreground">{name}</b>
            {namespace ? (
              <>
                {' '}
                in namespace <b className="text-foreground">{namespace}</b>
              </>
            ) : null}
            ? This action cannot be undone.
          </Dialog.Description>

          {deleteError && (
            <div className="mt-3 p-2 text-[11px] bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded">
              {deleteError}
            </div>
          )}

          <div className="mt-4 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={isDeleting}
              className="px-3 py-1.5 rounded text-xs text-foreground bg-surface-3 hover:bg-surface-2 border border-border transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium text-white bg-rose-600 hover:bg-rose-500 transition-colors cursor-pointer disabled:opacity-50"
            >
              {isDeleting && <Loader2 className="size-3 animate-spin" />}
              <span>Delete</span>
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Root>
    </>
  );
};
