import { useMemo } from 'react';
import { useKubeQuery } from './useKubeQuery';
import { type ConfigMapData } from '../types/ConfigMapData';
import { type K8sResource } from '../types/K8sResource';
import { formatAge } from '../utils/formatAge';

export function useConfigMaps(enabled: boolean) {
  const transform = useMemo(
    () => (items: K8sResource[]) => {
      return items.map((item) => {
        const keysList = Object.keys(item.data || {});
        return {
          id: `${item.metadata?.namespace || ''}/${item.metadata?.name || ''}`,
          name: item.metadata?.name || '',
          ns: item.metadata?.namespace || '',
          keysCount: keysList.length,
          keysList,
          data: item.data as Record<string, string> | undefined,
          binaryData: item.binaryData,
          labels: item.metadata?.labels,
          annotations: item.metadata?.annotations,
          age: formatAge(item.metadata?.creationTimestamp || '')
        };
      });
    },
    []
  );

  return useKubeQuery<ConfigMapData>('configmaps', transform, enabled);
}
