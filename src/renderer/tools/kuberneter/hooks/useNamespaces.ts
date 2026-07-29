import { useMemo } from 'react';
import { useKubeQuery } from './useKubeQuery';
import { K8S_RESOURCE_KEYS } from '../constants/k8sResources';
import { type NamespaceData } from '../types/NamespaceData';
import { type K8sResource } from '../types/K8sResource';
import { formatAge } from '../utils/formatAge';

interface NSResource {
  metadata?: {
    name?: string;
    creationTimestamp?: string;
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
  };
  status?: {
    phase?: string;
  };
}

export function useNamespaces(enabled: boolean) {
  const transform = useMemo(
    () => (items: K8sResource[]) => {
      return items.map((item) => {
        const nsItem = item as unknown as NSResource;
        const name = nsItem.metadata?.name || '';
        const creationTimestamp = nsItem.metadata?.creationTimestamp || '';

        return {
          id: name,
          name,
          status: nsItem.status?.phase || 'Active',
          age: formatAge(creationTimestamp),
          createdTime: creationTimestamp ? new Date(creationTimestamp).toLocaleString() : '',
          labels: nsItem.metadata?.labels,
          annotations: nsItem.metadata?.annotations,
          rawItem: item
        };
      });
    },
    []
  );

  return useKubeQuery<NamespaceData>(K8S_RESOURCE_KEYS.NAMESPACES, transform, enabled);
}
