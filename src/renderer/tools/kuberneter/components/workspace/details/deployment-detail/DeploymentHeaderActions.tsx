import { useState, useCallback, type FC, type ComponentType } from 'react';
import {
  Scaling,
  RotateCcw,
  FileText,
  Pencil,
  Trash2,
  AlertTriangle,
  Loader2,
  Box
} from 'lucide-react';
import { Tooltip } from '@renderer/components/ui/Tooltip';
import { Popover } from '@renderer/components/ui/Popover';
import { Dialog } from '@renderer/components/ui/Dialog';
import { useQueryClient } from '@tanstack/react-query';
import { useLayoutStore } from '@renderer/store/layout.store';
import { useKuberneterStore } from '../../../../store/kuberneter.store';
import { type DeployData } from '../../../../types/DeployData';
import { ScaleResourceDialog } from '../shared/ScaleResourceDialog';
import * as jsYaml from 'js-yaml';

interface DeploymentHeaderActionsProps {
  payload: DeployData;
}

interface ContainerActionMenuProps {
  containers: Array<{ name: string }>;
  icon: ComponentType<{ className?: string }>;
  tooltipText: string;
  onSelect: (containerName?: string) => void;
  showAllContainersOption?: boolean;
}

const ContainerActionMenu: FC<ContainerActionMenuProps> = ({
  containers,
  icon: Icon,
  tooltipText,
  onSelect,
  showAllContainersOption = false
}: ContainerActionMenuProps) => {
  const [open, setOpen] = useState(false);

  if (containers.length <= 1) {
    return (
      <Tooltip.Root>
        <Tooltip.Trigger
          render={
            <button
              type="button"
              onClick={() => onSelect(containers[0]?.name)}
              className="text-zinc-400 hover:text-strong cursor-pointer hover:bg-border-dark/40 p-1 rounded transition-colors border-none bg-transparent flex items-center justify-center"
            >
              <Icon className="size-3.5" />
            </button>
          }
        />
        <Tooltip.Content side="bottom">{tooltipText}</Tooltip.Content>
      </Tooltip.Root>
    );
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Tooltip.Root>
        <Tooltip.Trigger
          render={
            <Popover.Trigger
              render={
                <button
                  type="button"
                  className="text-zinc-400 hover:text-strong cursor-pointer hover:bg-border-dark/40 p-1 rounded transition-colors border-none bg-transparent flex items-center justify-center"
                >
                  <Icon className="size-3.5" />
                </button>
              }
            />
          }
        />
        <Tooltip.Content side="bottom">{tooltipText}</Tooltip.Content>
      </Tooltip.Root>

      <Popover.Content
        side="bottom"
        align="end"
        className="p-1.5 min-w-[140px] bg-surface-2 border border-border-dark shadow-xl rounded-md z-50"
      >
        <div className="px-2 py-1 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider border-b border-border-dark/50 mb-1">
          Select Container
        </div>
        <div className="flex flex-col gap-0.5 max-h-48 overflow-y-auto">
          {showAllContainersOption && (
            <button
              type="button"
              onClick={() => {
                onSelect(undefined);
                setOpen(false);
              }}
              className="flex items-center gap-2 px-2 py-1.5 text-xs text-zinc-300 hover:text-strong hover:bg-accent/20 rounded transition-colors text-left border-none bg-transparent cursor-pointer font-mono"
            >
              <Box className="size-3 text-accent shrink-0" />
              <span className="truncate">All containers</span>
            </button>
          )}
          {containers.map((c) => (
            <button
              key={c.name}
              type="button"
              onClick={() => {
                onSelect(c.name);
                setOpen(false);
              }}
              className="flex items-center gap-2 px-2 py-1.5 text-xs text-zinc-300 hover:text-strong hover:bg-accent/20 rounded transition-colors text-left border-none bg-transparent cursor-pointer font-mono"
            >
              <Box className="size-3 text-zinc-400 shrink-0" />
              <span className="truncate">{c.name}</span>
            </button>
          ))}
        </div>
      </Popover.Content>
    </Popover.Root>
  );
};

export const DeploymentHeaderActions: FC<DeploymentHeaderActionsProps> = ({ payload }) => {
  const queryClient = useQueryClient();
  const activeInstanceId = useLayoutStore((s) => s.activeInstanceId);
  const activeTabId = useLayoutStore((s) => s.activeTabId);
  const closeTab = useLayoutStore((s) => s.closeTab);
  const cluster = useKuberneterStore((s) => s.kuberneterInstanceCluster[activeInstanceId] || '');
  const rawConfigPath = useKuberneterStore(
    (s) => s.kuberneterInstanceConfigPath[activeInstanceId] || 'default'
  );
  const openResourceEditTab = useKuberneterStore((s) => s.openResourceEditTab);
  const openDeploymentLogsTab = useKuberneterStore((s) => s.openDeploymentLogsTab);
  const setDrawerState = useKuberneterStore((s) => s.setKuberneterTabDrawerState);

  const [scaleDialogOpen, setScaleDialogOpen] = useState(false);
  const [restartDialogOpen, setRestartDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const [isRestarting, setIsRestarting] = useState(false);
  const [restartError, setRestartError] = useState<string | null>(null);

  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const name = payload?.name || payload?.rawItem?.metadata?.name || '';
  const namespace = payload?.ns || payload?.rawItem?.metadata?.namespace;

  const rawTemplateSpec = (payload?.rawItem as Record<string, unknown> | undefined)?.spec as
    | {
        replicas?: number;
        template?: { spec?: { containers?: Array<{ name: string }> } };
      }
    | undefined;

  const containers: Array<{ name: string }> = rawTemplateSpec?.template?.spec?.containers || [];
  const currentReplicas = rawTemplateSpec?.replicas ?? payload?.replicas ?? 1;

  const handleLogs = useCallback(
    (containerName?: string) => {
      if (name) {
        openDeploymentLogsTab(name, namespace, containerName);
      }
    },
    [name, namespace, openDeploymentLogsTab]
  );

  const handleEdit = useCallback(() => {
    if (name) {
      openResourceEditTab('deployments', name, namespace, payload?.rawItem || payload);
    }
  }, [name, namespace, payload, openResourceEditTab]);

  const handleRestart = useCallback(async () => {
    if (!name) return;
    setIsRestarting(true);
    setRestartError(null);

    try {
      const configPathArg = rawConfigPath === 'default' ? undefined : rawConfigPath;
      const restartPatch = {
        apiVersion: 'apps/v1',
        kind: 'Deployment',
        metadata: {
          name,
          ...(namespace ? { namespace } : {})
        },
        spec: {
          template: {
            metadata: {
              annotations: {
                'kubectl.kubernetes.io/restartedAt': new Date().toISOString()
              }
            }
          }
        }
      };

      const yamlContent = jsYaml.dump(restartPatch);
      const res = await window.kuberneter.applyResourceYaml(yamlContent, configPathArg, cluster);

      if (res.error) {
        setRestartError(res.error);
        return;
      }

      useKuberneterStore.getState().addToast({
        type: 'info',
        title: 'Deployment Restarted',
        message: `Rolling restart initiated for deployment "${name}".`
      });

      queryClient.invalidateQueries({ queryKey: ['kuberneter'] });
      setRestartDialogOpen(false);
    } catch (err) {
      setRestartError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsRestarting(false);
    }
  }, [name, namespace, rawConfigPath, cluster, queryClient]);

  const handleDelete = useCallback(async () => {
    if (!name) return;
    setIsDeleting(true);
    setDeleteError(null);

    try {
      const configPathArg = rawConfigPath === 'default' ? undefined : rawConfigPath;
      const res = await window.kuberneter.deleteResource(
        configPathArg,
        cluster,
        'deployments',
        name,
        namespace
      );

      if (res.success) {
        useKuberneterStore.getState().addToast({
          type: 'info',
          title: 'Deployment Deleted',
          message: `Deployment "${name}" was deleted successfully.`
        });
        setDeleteDialogOpen(false);

        queryClient.invalidateQueries({ queryKey: ['kuberneter'] });

        if (activeTabId) {
          setDrawerState(activeTabId, { isOpen: false });
        }

        if (
          activeTabId &&
          (activeTabId.includes('deployment-detail') || activeTabId.includes('deployments-detail'))
        ) {
          closeTab(activeTabId);
        }
      } else {
        setDeleteError(res.error || 'Failed to delete deployment.');
      }
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsDeleting(false);
    }
  }, [name, namespace, rawConfigPath, cluster, queryClient, activeTabId, setDrawerState, closeTab]);

  return (
    <>
      <Tooltip.Provider delay={200} closeDelay={0}>
        {/* 1. Scale Button */}
        <Tooltip.Root>
          <Tooltip.Trigger
            render={
              <button
                type="button"
                onClick={() => setScaleDialogOpen(true)}
                className="text-zinc-400 hover:text-strong cursor-pointer hover:bg-border-dark/40 p-1 rounded transition-colors border-none bg-transparent flex items-center justify-center"
              >
                <Scaling className="size-3.5" />
              </button>
            }
          />
          <Tooltip.Content side="bottom">Scale Deployment</Tooltip.Content>
        </Tooltip.Root>

        {/* 2. Restart Button */}
        <Tooltip.Root>
          <Tooltip.Trigger
            render={
              <button
                type="button"
                onClick={() => {
                  setRestartError(null);
                  setRestartDialogOpen(true);
                }}
                className="text-zinc-400 hover:text-strong cursor-pointer hover:bg-border-dark/40 p-1 rounded transition-colors border-none bg-transparent flex items-center justify-center"
              >
                <RotateCcw className="size-3.5" />
              </button>
            }
          />
          <Tooltip.Content side="bottom">Restart Deployment</Tooltip.Content>
        </Tooltip.Root>

        {/* 3. Deployment Logs */}
        <ContainerActionMenu
          containers={containers}
          icon={FileText}
          tooltipText="Deployment Logs"
          onSelect={handleLogs}
          showAllContainersOption
        />

        {/* 4. Edit YAML */}
        <Tooltip.Root>
          <Tooltip.Trigger
            render={
              <button
                type="button"
                onClick={handleEdit}
                className="text-zinc-400 hover:text-strong cursor-pointer hover:bg-border-dark/40 p-1 rounded transition-colors border-none bg-transparent flex items-center justify-center"
              >
                <Pencil className="size-3.5" />
              </button>
            }
          />
          <Tooltip.Content side="bottom">Edit YAML</Tooltip.Content>
        </Tooltip.Root>

        {/* 5. Delete Deployment */}
        <Tooltip.Root>
          <Tooltip.Trigger
            render={
              <button
                type="button"
                onClick={() => {
                  setDeleteError(null);
                  setDeleteDialogOpen(true);
                }}
                className="text-zinc-400 hover:text-rose-400 cursor-pointer hover:bg-border-dark/40 p-1 rounded transition-colors border-none bg-transparent flex items-center justify-center"
              >
                <Trash2 className="size-3.5" />
              </button>
            }
          />
          <Tooltip.Content side="bottom">Delete Deployment</Tooltip.Content>
        </Tooltip.Root>
      </Tooltip.Provider>

      {/* Scale Dialog */}
      <ScaleResourceDialog
        open={scaleDialogOpen}
        onOpenChange={setScaleDialogOpen}
        resourceKind="Deployment"
        name={name}
        namespace={namespace}
        currentReplicas={currentReplicas}
      />

      {/* Restart Confirmation Dialog */}
      <Dialog.Root open={restartDialogOpen} onOpenChange={setRestartDialogOpen}>
        <Dialog.Content className="max-w-sm">
          <Dialog.Title className="flex items-center gap-2 text-foreground">
            <RotateCcw className="size-4 text-accent shrink-0" />
            <span>Restart Deployment</span>
          </Dialog.Title>
          <Dialog.Description className="mt-2 text-xs leading-relaxed text-muted-foreground">
            Are you sure you want to trigger a zero-downtime rolling restart for deployment{' '}
            <b className="text-foreground font-mono">{name}</b>
            {namespace ? (
              <>
                {' '}
                in namespace <b className="text-foreground font-mono">{namespace}</b>
              </>
            ) : null}
            ?
          </Dialog.Description>

          {restartError && (
            <div className="mt-3 p-2 text-[11px] bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded">
              {restartError}
            </div>
          )}

          <div className="mt-4 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setRestartDialogOpen(false)}
              disabled={isRestarting}
              className="px-3 py-1.5 rounded text-xs text-foreground bg-surface-3 hover:bg-surface-2 border border-border transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleRestart}
              disabled={isRestarting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium text-white bg-accent hover:bg-accent/90 transition-colors cursor-pointer disabled:opacity-50 shadow-sm"
            >
              {isRestarting && <Loader2 className="size-3 animate-spin" />}
              <span>Restart</span>
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Root>

      {/* Delete Confirmation Dialog */}
      <Dialog.Root open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <Dialog.Content className="max-w-sm">
          <Dialog.Title className="flex items-center gap-2 text-rose-500">
            <AlertTriangle className="size-4 text-rose-500 shrink-0" />
            <span>Delete Deployment</span>
          </Dialog.Title>
          <Dialog.Description className="mt-2 text-xs leading-relaxed text-muted-foreground">
            Are you sure you want to delete deployment{' '}
            <b className="text-foreground font-mono">{name}</b>
            {namespace ? (
              <>
                {' '}
                in namespace <b className="text-foreground font-mono">{namespace}</b>
              </>
            ) : null}
            ? All managed pods and replica sets will be removed. This action cannot be undone.
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
