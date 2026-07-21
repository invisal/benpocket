import { useMemo } from 'react';
import { useKubeQuery } from './useKubeQuery';
import {
  type ClusterRoleBindingData,
  type Subject,
  type RoleRef
} from '../types/ClusterRoleBindingData';
import { type K8sResource } from '../types/K8sResource';
import { formatAge } from '../utils/formatAge';

export function useClusterRoleBindings(enabled: boolean) {
  const transform = useMemo(
    () => (items: K8sResource[]) => {
      return items.map((item) => {
        const crbItem = item as unknown as {
          metadata?: K8sResource['metadata'];
          roleRef?: RoleRef;
          subjects?: Subject[];
        };

        const name = crbItem.metadata?.name || '';
        const creationTimestamp = crbItem.metadata?.creationTimestamp || '';

        return {
          id: name,
          name,
          age: formatAge(creationTimestamp),
          createdTime: creationTimestamp ? new Date(creationTimestamp).toLocaleString() : '',
          labels: crbItem.metadata?.labels,
          annotations: crbItem.metadata?.annotations,
          roleRef: crbItem.roleRef,
          subjects: crbItem.subjects || [],
          rawItem: item
        };
      });
    },
    []
  );

  return useKubeQuery<ClusterRoleBindingData>('clusterrolebindings', transform, enabled);
}
