import { useMemo } from 'react';
import { useKubeQuery } from './useKubeQuery';
import { type PriorityClassData } from '../types/PriorityClassData';
import { type K8sResource } from '../types/K8sResource';
import { formatAge } from '../utils/formatAge';

export function usePriorityClasses(enabled: boolean) {
  const transform = useMemo(
    () => (items: K8sResource[]) => {
      return items.map((item) => {
        const pcItem = item as unknown as {
          metadata?: K8sResource['metadata'];
          value?: number;
          globalDefault?: boolean;
          description?: string;
        };

        const name = pcItem.metadata?.name || '';
        const value = pcItem.value ?? 0;
        const globalDefault = pcItem.globalDefault ?? false;
        const description = pcItem.description || '';

        const creationTimestamp = pcItem.metadata?.creationTimestamp || '';

        return {
          id: name,
          name,
          labels: pcItem.metadata?.labels,
          annotations: pcItem.metadata?.annotations,
          age: formatAge(creationTimestamp),
          createdTime: creationTimestamp ? new Date(creationTimestamp).toLocaleString() : '',
          value,
          globalDefault,
          description
        };
      });
    },
    []
  );

  return useKubeQuery<PriorityClassData>('priorityclasses', transform, enabled);
}
