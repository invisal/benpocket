import { useMemo } from 'react';
import { useKubeQuery } from './useKubeQuery';
import { K8S_RESOURCE_KEYS } from '../constants/k8sResources';
import { type ClusterRoleData, type ClusterRoleRule } from '../types/ClusterRoleData';
import { type K8sResource } from '../types/K8sResource';
import { formatAge } from '../utils/formatAge';

export function useClusterRoles(enabled: boolean) {
  const transform = useMemo(
    () => (items: K8sResource[]) => {
      return items.map((item) => {
        const crItem = item as unknown as {
          metadata?: K8sResource['metadata'];
          rules?: ClusterRoleRule[];
        };

        const name = crItem.metadata?.name || '';
        const creationTimestamp = crItem.metadata?.creationTimestamp || '';

        return {
          id: name,
          name,
          age: formatAge(creationTimestamp),
          createdTime: creationTimestamp ? new Date(creationTimestamp).toLocaleString() : '',
          labels: crItem.metadata?.labels,
          annotations: crItem.metadata?.annotations,
          rules: crItem.rules || [],
          rawItem: item
        };
      });
    },
    []
  );

  return useKubeQuery<ClusterRoleData>(K8S_RESOURCE_KEYS.CLUSTER_ROLES, transform, enabled);
}
