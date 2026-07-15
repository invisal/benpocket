import { useMemo } from 'react';
import { useKubeQuery } from './useKubeQuery';
import { type ServiceData } from '../types/ServiceData';
import { type K8sResource } from '../types/K8sResource';
import { formatAge } from '../utils/formatAge';

export function useServices(enabled: boolean) {
  const transform = useMemo(
    () => (items: K8sResource[]) => {
      return items.map((item) => {
        const ports = item.spec?.ports?.map((p) => `${p.port}/${p.protocol}`).join(', ') || '';
        return {
          name: item.metadata?.name || '',
          ns: item.metadata?.namespace || '',
          type: item.spec?.type || 'ClusterIP',
          clusterIp: item.spec?.clusterIP || '',
          ports,
          age: formatAge(item.metadata?.creationTimestamp || '')
        };
      });
    },
    []
  );

  return useKubeQuery<ServiceData>('services', transform, enabled);
}
