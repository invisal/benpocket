import { useState, useCallback, type FC } from 'react';
import { MinusCircle, PlusCircle, Loader2 } from 'lucide-react';
import { Dialog } from '@renderer/components/ui/Dialog';
import { useQueryClient } from '@tanstack/react-query';
import { useLayoutStore } from '@renderer/store/layout.store';
import { useKuberneterStore } from '../../../../store/kuberneter.store';
import * as jsYaml from 'js-yaml';

interface ScaleResourceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resourceKind: 'Deployment' | 'ReplicaSet' | 'StatefulSet';
  name: string;
  namespace?: string;
  currentReplicas: number;
  onScaled?: (newReplicas: number) => void;
}

export const ScaleResourceDialog: FC<ScaleResourceDialogProps> = ({
  open,
  onOpenChange,
  resourceKind,
  name,
  namespace,
  currentReplicas,
  onScaled
}) => {
  const queryClient = useQueryClient();
  const activeInstanceId = useLayoutStore((s) => s.activeInstanceId);
  const cluster = useKuberneterStore((s) => s.kuberneterInstanceCluster[activeInstanceId] || '');
  const rawConfigPath = useKuberneterStore(
    (s) => s.kuberneterInstanceConfigPath[activeInstanceId] || 'default'
  );

  const [desiredReplicas, setDesiredReplicas] = useState<number>(currentReplicas ?? 1);
  const [prevOpen, setPrevOpen] = useState(open);
  const [prevCurrentReplicas, setPrevCurrentReplicas] = useState(currentReplicas);
  const [isScaling, setIsScaling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync desired replicas with currentReplicas when dialog opens
  if (open !== prevOpen || currentReplicas !== prevCurrentReplicas) {
    setPrevOpen(open);
    setPrevCurrentReplicas(currentReplicas);
    if (open) {
      setDesiredReplicas(currentReplicas ?? 1);
      setError(null);
    }
  }

  const sliderMax = Math.max(20, (currentReplicas || 1) * 2, desiredReplicas + 5);

  const handleDecrement = useCallback(() => {
    setDesiredReplicas((prev) => Math.max(0, prev - 1));
  }, []);

  const handleIncrement = useCallback(() => {
    setDesiredReplicas((prev) => prev + 1);
  }, []);

  const handleScale = useCallback(async () => {
    if (!name) return;
    setIsScaling(true);
    setError(null);

    try {
      const configPathArg = rawConfigPath === 'default' ? undefined : rawConfigPath;
      const patchObject = {
        apiVersion: 'apps/v1',
        kind: resourceKind,
        metadata: {
          name,
          ...(namespace ? { namespace } : {})
        },
        spec: {
          replicas: desiredReplicas
        }
      };

      const yamlContent = jsYaml.dump(patchObject);
      const res = await window.kuberneter.applyResourceYaml(yamlContent, configPathArg, cluster);

      if (res.error) {
        setError(res.error);
        return;
      }

      useKuberneterStore.getState().addToast({
        type: 'info',
        title: `${resourceKind} Scaled`,
        message: `${resourceKind} "${name}" scaled to ${desiredReplicas} replicas.`
      });

      queryClient.invalidateQueries({ queryKey: ['kuberneter'] });
      onScaled?.(desiredReplicas);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsScaling(false);
    }
  }, [
    name,
    namespace,
    resourceKind,
    desiredReplicas,
    rawConfigPath,
    cluster,
    queryClient,
    onScaled,
    onOpenChange
  ]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content className="max-w-md bg-surface border border-border-dark p-0 overflow-hidden shadow-2xl">
        {/* Header matching provided reference */}
        <div className="px-5 py-3.5 bg-surface-2 border-b border-border-dark pr-10">
          <Dialog.Title className="text-sm font-normal text-muted-foreground">
            Scale {resourceKind}{' '}
            <span className="font-bold text-foreground font-mono">
              {namespace ? `${namespace}/${name}` : name}
            </span>
          </Dialog.Title>
        </div>

        {/* Content Body */}
        <div className="p-5 flex flex-col gap-4 bg-surface">
          <div className="text-sm font-bold text-foreground">
            Current replica scale: {currentReplicas ?? 0}
          </div>

          <div className="text-sm text-zinc-300 font-normal">
            Desired number of replicas: {desiredReplicas}
          </div>

          {/* Stepper + Slider Control */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleDecrement}
              disabled={desiredReplicas <= 0 || isScaling}
              className="text-zinc-400 hover:text-foreground transition-colors cursor-pointer border-none bg-transparent p-0 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center"
              title="Decrease replicas"
            >
              <MinusCircle className="size-5" />
            </button>

            <div className="flex-1 relative flex items-center">
              <input
                type="range"
                min={0}
                max={sliderMax}
                value={desiredReplicas}
                onChange={(e) => setDesiredReplicas(parseInt(e.target.value, 10) || 0)}
                disabled={isScaling}
                className="w-full h-1.5 bg-surface-3 rounded-lg appearance-none cursor-pointer accent-accent transition-all focus:outline-none"
              />
            </div>

            <button
              type="button"
              onClick={handleIncrement}
              disabled={isScaling}
              className="text-zinc-400 hover:text-foreground transition-colors cursor-pointer border-none bg-transparent p-0 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center"
              title="Increase replicas"
            >
              <PlusCircle className="size-5" />
            </button>
          </div>

          {error && (
            <div className="p-2.5 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm rounded leading-relaxed">
              {error}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-surface-2 border-t border-border-dark">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={isScaling}
            className="px-4 py-1.5 rounded text-sm font-medium text-zinc-300 hover:text-white bg-surface-3 hover:bg-surface-4 border border-border-dark transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleScale}
            disabled={isScaling}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded text-sm font-medium text-white bg-accent hover:bg-accent/90 transition-colors cursor-pointer disabled:opacity-50 shadow-sm"
          >
            {isScaling && <Loader2 className="size-3 animate-spin" />}
            <span>Scale</span>
          </button>
        </div>
      </Dialog.Content>
    </Dialog.Root>
  );
};
