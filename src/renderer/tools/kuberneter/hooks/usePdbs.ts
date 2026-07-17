import { useMemo } from 'react';
import { useKubeQuery } from './useKubeQuery';
import { type PodDisruptionBudgetData } from '../types/PodDisruptionBudgetData';
import { type K8sResource } from '../types/K8sResource';
import { formatAge } from '../utils/formatAge';

export function usePdbs(enabled: boolean) {
  const transform = useMemo(
    () => (items: K8sResource[]) => {
      return items.map((item) => {
        const pdbItem = item as unknown as {
          metadata?: K8sResource['metadata'];
          spec?: {
            minAvailable?: number | string;
            maxUnavailable?: number | string;
            selector?: {
              matchLabels?: Record<string, string>;
            };
          };
          status?: {
            currentHealthy?: number;
            desiredHealthy?: number;
          };
        };

        const name = pdbItem.metadata?.name || '';
        const ns = pdbItem.metadata?.namespace || '';

        const minAvailable =
          pdbItem.spec?.minAvailable !== undefined ? String(pdbItem.spec.minAvailable) : 'N/A';
        const maxUnavailable =
          pdbItem.spec?.maxUnavailable !== undefined ? String(pdbItem.spec.maxUnavailable) : 'N/A';

        const matchLabels = pdbItem.spec?.selector?.matchLabels || {};
        const selector =
          Object.entries(matchLabels)
            .map(([k, v]) => `${k}=${v}`)
            .join(', ') || '';

        const currentHealthy = pdbItem.status?.currentHealthy ?? 0;
        const desiredHealthy = pdbItem.status?.desiredHealthy ?? 0;

        const creationTimestamp = pdbItem.metadata?.creationTimestamp || '';

        return {
          id: `${ns}/${name}`,
          name,
          ns,
          labels: pdbItem.metadata?.labels,
          annotations: pdbItem.metadata?.annotations,
          age: formatAge(creationTimestamp),
          createdTime: creationTimestamp ? new Date(creationTimestamp).toLocaleString() : '',
          selector,
          minAvailable,
          maxUnavailable,
          currentHealthy,
          desiredHealthy
        };
      });
    },
    []
  );

  return useKubeQuery<PodDisruptionBudgetData>('poddisruptionbudgets', transform, enabled);
}
