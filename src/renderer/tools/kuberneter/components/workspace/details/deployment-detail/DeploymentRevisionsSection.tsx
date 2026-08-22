import { memo, useState, useCallback, type FC } from 'react';
import { Age } from '../../../Age';
import { KubeTable } from '../../../kubeTable';
import { Menu } from '@renderer/components/ui/Menu';
import { ContextMenu } from '@renderer/components/ui/ContextMenu';
import { Dialog } from '@renderer/components/ui/Dialog';
import { Scaling, FileText, Pencil, Trash2, AlertTriangle, Loader2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useLayoutStore } from '@renderer/store/layout.store';
import { useKuberneterStore } from '../../../../store/kuberneter.store';
import { ScaleResourceDialog } from '../shared/ScaleResourceDialog';
import type { DeployRevision } from '../../../../types/DeployData';
import type { K8sResource } from '../../../../types/K8sResource';

interface DeploymentRevisionsSectionProps {
  revisions: DeployRevision[];
  namespace: string;
  onOpenReplicaSetDetail: (ns: string, name: string, rawItem?: K8sResource) => void;
}

export const DeploymentRevisionsSection: FC<DeploymentRevisionsSectionProps> = memo(
  function DeploymentRevisionsSection({
    revisions,
    namespace,
    onOpenReplicaSetDetail
  }: DeploymentRevisionsSectionProps) {
    const queryClient = useQueryClient();
    const activeInstanceId = useLayoutStore((s) => s.activeInstanceId);
    const cluster = useKuberneterStore((s) => s.kuberneterInstanceCluster[activeInstanceId] || '');
    const rawConfigPath = useKuberneterStore(
      (s) => s.kuberneterInstanceConfigPath[activeInstanceId] || 'default'
    );
    const openResourceEditTab = useKuberneterStore((s) => s.openResourceEditTab);
    const openReplicaSetLogsTab = useKuberneterStore((s) => s.openReplicaSetLogsTab);

    // Scale Dialog State for selected ReplicaSet
    const [scalingTarget, setScalingTarget] = useState<{
      name: string;
      replicas: number;
    } | null>(null);

    // Delete Dialog State for selected ReplicaSet
    const [deletingTarget, setDeletingTarget] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);

    const handleShowDetails = useCallback(
      (row: DeployRevision) => {
        onOpenReplicaSetDetail(
          namespace,
          row.name,
          (row as unknown as { rawItem?: K8sResource }).rawItem
        );
      },
      [namespace, onOpenReplicaSetDetail]
    );

    const handleScale = useCallback((row: DeployRevision) => {
      const raw = (row as unknown as { rawItem?: K8sResource }).rawItem;
      const replicas = (raw?.spec?.replicas as number) ?? 1;
      setScalingTarget({ name: row.name, replicas });
    }, []);

    const handleLogs = useCallback(
      (row: DeployRevision) => {
        openReplicaSetLogsTab(row.name, namespace);
      },
      [namespace, openReplicaSetLogsTab]
    );

    const handleEdit = useCallback(
      (row: DeployRevision) => {
        const raw = (row as unknown as { rawItem?: K8sResource }).rawItem;
        openResourceEditTab('replicasets', row.name, namespace, raw);
      },
      [namespace, openResourceEditTab]
    );

    const handleDelete = useCallback((row: DeployRevision) => {
      setDeleteError(null);
      setDeletingTarget(row.name);
    }, []);

    const executeDelete = useCallback(async () => {
      if (!deletingTarget) return;
      setIsDeleting(true);
      setDeleteError(null);

      try {
        const configPathArg = rawConfigPath === 'default' ? undefined : rawConfigPath;
        const res = await window.kuberneter.deleteResource(
          configPathArg,
          cluster,
          'replicasets',
          deletingTarget,
          namespace
        );

        if (res.success) {
          useKuberneterStore.getState().addToast({
            type: 'info',
            title: 'ReplicaSet Deleted',
            message: `ReplicaSet "${deletingTarget}" was deleted successfully.`
          });
          setDeletingTarget(null);
          queryClient.invalidateQueries({ queryKey: ['kuberneter'] });
        } else {
          setDeleteError(res.error || 'Failed to delete ReplicaSet.');
        }
      } catch (err) {
        setDeleteError(err instanceof Error ? err.message : String(err));
      } finally {
        setIsDeleting(false);
      }
    }, [deletingTarget, rawConfigPath, cluster, namespace, queryClient]);

    return (
      <>
        <div className="flex flex-col gap-2 mt-1 border-t border-border-dark/60 pt-3">
          <span className="text-[10px] font-bold text-zinc-455 uppercase tracking-wider">
            Deploy Revisions
          </span>
          {revisions.length === 0 ? (
            <div className="text-sm text-zinc-500 italic pl-1">No revisions found</div>
          ) : (
            <div className="border-y border-border/40 flex flex-col max-h-[160px] h-auto w-full overflow-y-auto">
              <KubeTable<DeployRevision>
                columns={[
                  {
                    key: 'revision',
                    header: '#',
                    className: 'py-2 px-3 text-zinc-200',
                    render: (row) => {
                      const index = revisions.findIndex((r) => r.name === row.name);
                      return (
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`w-1 h-3 rounded-sm ${index === 0 ? 'bg-emerald-500' : 'bg-zinc-650/60'}`}
                          />
                          <span>{row.revision}</span>
                        </div>
                      );
                    }
                  },
                  {
                    key: 'name',
                    header: 'Summary',
                    className: 'py-2 px-3 text-zinc-400 truncate max-w-[200px]',
                    render: (row) => (
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          handleShowDetails(row);
                        }}
                        className="text-accent hover:underline cursor-pointer font-mono"
                        title={row.name}
                      >
                        {row.name}
                      </span>
                    )
                  },
                  {
                    key: 'podsCount',
                    header: 'Pods',
                    className: 'py-2 px-3 text-zinc-300'
                  },
                  {
                    key: 'age',
                    header: 'Age',
                    className: 'py-2 px-3 text-zinc-450',
                    render: (row) => (
                      <Age
                        timestamp={
                          (row as unknown as Record<string, unknown>).creationTimestamp as string
                        }
                      />
                    )
                  },
                  {
                    key: 'actions',
                    header: '',
                    className: 'py-1 px-2 text-center w-8 shrink-0',
                    render: (row) => (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center justify-center"
                      >
                        <Menu.Root>
                          <Menu.Trigger
                            render={
                              <button
                                type="button"
                                title="Actions"
                                className="size-6 flex items-center justify-center rounded text-zinc-400 hover:text-zinc-200 hover:bg-surface-3 transition-colors border-none bg-transparent cursor-pointer"
                              >
                                ⋮
                              </button>
                            }
                          />
                          <Menu.Content align="end" className="min-w-36">
                            <Menu.Item
                              onClick={() => handleShowDetails(row)}
                              className="cursor-pointer text-sm"
                            >
                              <span>Show Details</span>
                            </Menu.Item>
                            <Menu.Item
                              onClick={() => handleScale(row)}
                              className="flex items-center gap-2 cursor-pointer text-sm"
                            >
                              <Scaling className="size-3.5 text-zinc-400" />
                              <span>Scale</span>
                            </Menu.Item>
                            <Menu.Item
                              onClick={() => handleLogs(row)}
                              className="flex items-center gap-2 cursor-pointer text-sm"
                            >
                              <FileText className="size-3.5 text-zinc-400" />
                              <span>Logs</span>
                            </Menu.Item>
                            <Menu.Item
                              onClick={() => handleEdit(row)}
                              className="flex items-center gap-2 cursor-pointer text-sm"
                            >
                              <Pencil className="size-3.5 text-zinc-400" />
                              <span>Edit</span>
                            </Menu.Item>
                            <Menu.Separator />
                            <Menu.Item
                              onClick={() => handleDelete(row)}
                              className="flex items-center gap-2 cursor-pointer text-sm text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 focus:text-rose-300 focus:bg-rose-500/10"
                            >
                              <Trash2 className="size-3.5 text-rose-400" />
                              <span>Delete</span>
                            </Menu.Item>
                          </Menu.Content>
                        </Menu.Root>
                      </div>
                    )
                  }
                ]}
                data={revisions}
                getRowKey={(row) => row.name}
                onRowClick={(row) => handleShowDetails(row)}
                resizable={false}
                renderRowWrapper={(row, children) => (
                  <ContextMenu.Root key={row.name}>
                    <ContextMenu.Trigger render={children as React.ReactElement} />
                    <ContextMenu.Content className="min-w-36">
                      <ContextMenu.Item
                        onClick={() => handleShowDetails(row)}
                        className="cursor-pointer text-sm"
                      >
                        <span>Show Details</span>
                      </ContextMenu.Item>
                      <ContextMenu.Item
                        onClick={() => handleScale(row)}
                        className="flex items-center gap-2 cursor-pointer text-sm"
                      >
                        <Scaling className="size-3.5 text-zinc-400" />
                        <span>Scale</span>
                      </ContextMenu.Item>
                      <ContextMenu.Item
                        onClick={() => handleLogs(row)}
                        className="flex items-center gap-2 cursor-pointer text-sm"
                      >
                        <FileText className="size-3.5 text-zinc-400" />
                        <span>Logs</span>
                      </ContextMenu.Item>
                      <ContextMenu.Item
                        onClick={() => handleEdit(row)}
                        className="flex items-center gap-2 cursor-pointer text-sm"
                      >
                        <Pencil className="size-3.5 text-zinc-400" />
                        <span>Edit</span>
                      </ContextMenu.Item>
                      <ContextMenu.Separator />
                      <ContextMenu.Item
                        onClick={() => handleDelete(row)}
                        className="flex items-center gap-2 cursor-pointer text-sm text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 focus:text-rose-300 focus:bg-rose-500/10"
                      >
                        <Trash2 className="size-3.5 text-rose-400" />
                        <span>Delete</span>
                      </ContextMenu.Item>
                    </ContextMenu.Content>
                  </ContextMenu.Root>
                )}
              />
            </div>
          )}
        </div>

        {/* ReplicaSet Scale Dialog */}
        {scalingTarget && (
          <ScaleResourceDialog
            open={!!scalingTarget}
            onOpenChange={(open) => {
              if (!open) setScalingTarget(null);
            }}
            resourceKind="ReplicaSet"
            name={scalingTarget.name}
            namespace={namespace}
            currentReplicas={scalingTarget.replicas}
          />
        )}

        {/* ReplicaSet Delete Dialog */}
        <Dialog.Root
          open={!!deletingTarget}
          onOpenChange={(open) => {
            if (!open) setDeletingTarget(null);
          }}
        >
          <Dialog.Content className="max-w-sm">
            <Dialog.Title className="flex items-center gap-2 text-rose-500">
              <AlertTriangle className="size-4 text-rose-500 shrink-0" />
              <span>Delete ReplicaSet</span>
            </Dialog.Title>
            <Dialog.Description className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Are you sure you want to delete ReplicaSet{' '}
              <b className="text-foreground font-mono">{deletingTarget}</b>
              {namespace ? (
                <>
                  {' '}
                  in namespace <b className="text-foreground font-mono">{namespace}</b>
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
                onClick={() => setDeletingTarget(null)}
                disabled={isDeleting}
                className="px-3 py-1.5 rounded text-sm text-foreground bg-surface-3 hover:bg-surface-2 border border-border transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeDelete}
                disabled={isDeleting}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium text-white bg-rose-600 hover:bg-rose-500 transition-colors cursor-pointer disabled:opacity-50"
              >
                {isDeleting && <Loader2 className="size-3 animate-spin" />}
                <span>Delete</span>
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Root>
      </>
    );
  }
);
