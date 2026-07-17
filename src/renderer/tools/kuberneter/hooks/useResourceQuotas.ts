import { useMemo } from 'react';
import { useKubeQuery } from './useKubeQuery';
import { type ResourceQuotaData } from '../types/ResourceQuotaData';
import { type K8sResource } from '../types/K8sResource';
import { formatAge } from '../utils/formatAge';

export function useResourceQuotas(enabled: boolean) {
  const transform = useMemo(
    () => (items: K8sResource[]) => {
      return items.map((item) => {
        const rqItem = item as unknown as {
          metadata?: K8sResource['metadata'];
          spec?: { hard?: Record<string, string> };
          status?: { hard?: Record<string, string>; used?: Record<string, string> };
        };
        const name = rqItem.metadata?.name || '';
        const ns = rqItem.metadata?.namespace || '';

        const specHard = rqItem.spec?.hard || {};
        const statusHard = rqItem.status?.hard || {};
        const statusUsed = rqItem.status?.used || {};

        const resourceKeys = Array.from(
          new Set([...Object.keys(specHard), ...Object.keys(statusHard)])
        );

        const quotas = resourceKeys.map((key) => {
          const hardVal = statusHard[key] || specHard[key] || '0';
          const usedVal = statusUsed[key] || '0';
          return {
            resourceName: key,
            used: usedVal,
            hard: hardVal
          };
        });

        const creationTimestamp = rqItem.metadata?.creationTimestamp || '';

        return {
          id: `${ns}/${name}`,
          name,
          ns,
          labels: rqItem.metadata?.labels,
          annotations: rqItem.metadata?.annotations,
          age: formatAge(creationTimestamp),
          createdTime: creationTimestamp ? new Date(creationTimestamp).toLocaleString() : '',
          quotas
        };
      });
    },
    []
  );

  return useKubeQuery<ResourceQuotaData>('resourcequotas', transform, enabled);
}
