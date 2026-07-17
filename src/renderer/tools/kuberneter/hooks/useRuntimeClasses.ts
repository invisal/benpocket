import { useMemo } from 'react';
import { useKubeQuery } from './useKubeQuery';
import { type RuntimeClassData } from '../types/RuntimeClassData';
import { type K8sResource } from '../types/K8sResource';
import { formatAge } from '../utils/formatAge';

export function useRuntimeClasses(enabled: boolean) {
  const transform = useMemo(
    () => (items: K8sResource[]) => {
      return items.map((item) => {
        const rcItem = item as unknown as {
          metadata?: K8sResource['metadata'];
          handler?: string;
          scheduling?: {
            nodeSelector?: Record<string, string>;
            tolerations?: unknown[];
          };
        };

        const name = rcItem.metadata?.name || '';
        const handler = rcItem.handler || '';

        const nodeSelectorMap = rcItem.scheduling?.nodeSelector || {};
        const nodeSelector =
          Object.entries(nodeSelectorMap)
            .map(([k, v]) => `${k}: ${v}`)
            .join(', ') || '';

        const tolerationsCount = rcItem.scheduling?.tolerations?.length ?? 0;

        const creationTimestamp = rcItem.metadata?.creationTimestamp || '';

        return {
          id: name,
          name,
          labels: rcItem.metadata?.labels,
          annotations: rcItem.metadata?.annotations,
          age: formatAge(creationTimestamp),
          createdTime: creationTimestamp ? new Date(creationTimestamp).toLocaleString() : '',
          handler,
          nodeSelector,
          tolerationsCount
        };
      });
    },
    []
  );

  return useKubeQuery<RuntimeClassData>('runtimeclasses', transform, enabled);
}
