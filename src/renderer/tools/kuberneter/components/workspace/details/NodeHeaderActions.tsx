import type React from 'react';
import { useState } from 'react';
import { Pencil, Trash2, Terminal, Pause, Play, RefreshCw, AlertTriangle } from 'lucide-react';
import { Tooltip } from '@renderer/components/ui/Tooltip';
import { Dialog } from '@renderer/components/ui/Dialog';
import { useLayoutStore } from '../../../../../src/store/layout.store';
import { useKuberneterStore } from '../../../store/kuberneter.store';
import { type NodeData } from '../../../types/NodeData';

interface NodeHeaderActionsProps {
  payload: NodeData;
}

export const NodeHeaderActions: React.FC<NodeHeaderActionsProps> = ({ payload }) => {
  const name = payload?.name || '';
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const activeInstanceId = useLayoutStore((s) => s.activeInstanceId);
  const cluster = useKuberneterStore((s) => s.kuberneterInstanceCluster[activeInstanceId] || '');
  const rawConfigPath = useKuberneterStore(
    (s) => s.kuberneterInstanceConfigPath[activeInstanceId] || 'default'
  );
  const configPath = rawConfigPath === 'default' ? undefined : rawConfigPath;

  const rawItemObj = payload?.rawItem as { spec?: { unschedulable?: boolean } } | undefined;
  const isUnschedulable =
    rawItemObj?.spec?.unschedulable === true ||
    payload?.conditions?.includes('SchedulingDisabled') ||
    payload?.rawConditions?.includes('SchedulingDisabled') ||
    false;

  const handleShell = () => {
    if (name) {
      useKuberneterStore.getState().openNodeTerminalTab(name);
    }
  };

  const handleEdit = () => {
    if (name) {
      void useKuberneterStore.getState().openNodeEditTab(name, payload?.rawItem);
    }
  };

  const handleToggleCordon = async () => {
    if (!name) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const targetState = !isUnschedulable;
      const res = await window.kuberneter.cordonNode(
        configPath,
        cluster || undefined,
        name,
        targetState
      );
      if (res.success) {
        setConfirmOpen(false);
      } else {
        setErrorMsg(res.error || 'Failed to update node cordon state.');
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Tooltip.Provider delay={200} closeDelay={0}>
        <Tooltip.Root>
          <Tooltip.Trigger
            render={
              <button
                onClick={handleShell}
                className="text-zinc-400 hover:text-strong cursor-pointer hover:bg-border-dark/40 p-1 rounded transition-colors border-none bg-transparent flex items-center justify-center"
              >
                <Terminal className="size-3.5" />
              </button>
            }
          />
          <Tooltip.Content side="bottom">Node Shell</Tooltip.Content>
        </Tooltip.Root>

        <Tooltip.Root>
          <Tooltip.Trigger
            render={
              <button
                onClick={() => {
                  setErrorMsg(null);
                  setConfirmOpen(true);
                }}
                className={`cursor-pointer hover:bg-border-dark/40 p-1 rounded transition-colors border-none bg-transparent flex items-center justify-center ${
                  isUnschedulable
                    ? 'text-amber-400 hover:text-amber-300'
                    : 'text-zinc-400 hover:text-strong'
                }`}
              >
                {isUnschedulable ? <Play className="size-3.5" /> : <Pause className="size-3.5" />}
              </button>
            }
          />
          <Tooltip.Content side="bottom">
            {isUnschedulable ? 'Uncordon Node' : 'Cordon Node'}
          </Tooltip.Content>
        </Tooltip.Root>

        <Tooltip.Root>
          <Tooltip.Trigger
            render={
              <button
                onClick={handleEdit}
                className="text-zinc-400 hover:text-strong cursor-pointer hover:bg-border-dark/40 p-1 rounded transition-colors border-none bg-transparent flex items-center justify-center"
              >
                <Pencil className="size-3.5" />
              </button>
            }
          />
          <Tooltip.Content side="bottom">Edit YAML</Tooltip.Content>
        </Tooltip.Root>

        <Tooltip.Root>
          <Tooltip.Trigger
            render={
              <button className="text-zinc-400 hover:text-red-400 cursor-pointer hover:bg-border-dark/40 p-1 rounded transition-colors border-none bg-transparent flex items-center justify-center">
                <Trash2 className="size-3.5" />
              </button>
            }
          />
          <Tooltip.Content side="bottom">Delete</Tooltip.Content>
        </Tooltip.Root>
      </Tooltip.Provider>

      <Dialog.Root open={confirmOpen} onOpenChange={setConfirmOpen}>
        <Dialog.Content className="max-w-sm">
          <Dialog.Title className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-amber-500 shrink-0" />
            <span>{isUnschedulable ? 'Uncordon Node' : 'Cordon Node'}</span>
          </Dialog.Title>
          <Dialog.Description className="mt-2 text-xs leading-relaxed text-muted-foreground">
            {isUnschedulable ? (
              <>
                Are you sure you want to uncordon node <b className="text-foreground">{name}</b>?
                The Kubernetes scheduler will resume placing new pods on this node.
              </>
            ) : (
              <>
                Are you sure you want to cordon node <b className="text-foreground">{name}</b>? New
                pods will not be scheduled on this node until it is uncordoned.
              </>
            )}
          </Dialog.Description>

          {errorMsg && (
            <div className="mt-3 p-2 text-[11px] bg-red-500/10 border border-red-500/30 text-red-400 rounded">
              {errorMsg}
            </div>
          )}

          <div className="mt-4 flex items-center justify-end gap-2">
            <button
              onClick={() => setConfirmOpen(false)}
              disabled={loading}
              className="px-3 py-1.5 rounded text-xs text-foreground bg-surface-3 hover:bg-surface-2 border border-border transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={() => void handleToggleCordon()}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium text-white bg-amber-600 hover:bg-amber-500 transition-colors cursor-pointer disabled:opacity-50"
            >
              {loading && <RefreshCw className="size-3 animate-spin" />}
              <span>{isUnschedulable ? 'Uncordon' : 'Cordon'}</span>
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Root>
    </>
  );
};
