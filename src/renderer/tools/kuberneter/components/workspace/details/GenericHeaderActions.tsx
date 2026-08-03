import type React from 'react';
import { Pencil } from 'lucide-react';
import { Tooltip } from '@renderer/components/ui/Tooltip';
import { useKuberneterStore } from '../../../store/kuberneter.store';
import type { KubernetesObject } from '@kubernetes/client-node';

interface GenericHeaderActionsProps {
  contentType: string;
  payload: unknown;
}

export const GenericHeaderActions: React.FC<GenericHeaderActionsProps> = ({
  contentType,
  payload
}) => {
  const openResourceEditTab = useKuberneterStore((s) => s.openResourceEditTab);
  const obj = (payload || {}) as KubernetesObject;
  const name = obj.metadata?.name || (payload as { name?: string })?.name || '';
  const namespace = obj.metadata?.namespace || (payload as { ns?: string })?.ns;
  const kind = obj.kind || contentType;

  const handleEdit = () => {
    if (name) {
      openResourceEditTab(kind.toLowerCase(), name, namespace, payload);
    }
  };

  return (
    <Tooltip.Provider delay={200} closeDelay={0}>
      <Tooltip.Root>
        <Tooltip.Trigger
          render={
            <button
              onClick={handleEdit}
              title="Edit YAML"
              className="text-zinc-400 hover:text-white cursor-pointer hover:bg-border-dark/40 p-1 rounded transition-colors border-none bg-transparent flex items-center justify-center"
            >
              <Pencil className="size-3.5" />
            </button>
          }
        />
        <Tooltip.Content side="bottom">Edit YAML</Tooltip.Content>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
};
