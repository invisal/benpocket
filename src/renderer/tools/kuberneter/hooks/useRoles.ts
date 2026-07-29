import { useMemo } from 'react';
import { useKubeQuery } from './useKubeQuery';
import { K8S_RESOURCE_KEYS } from '../constants/k8sResources';
import { type RoleData, type RoleRule } from '../types/RoleData';
import { type K8sResource } from '../types/K8sResource';
import { formatAge } from '../utils/formatAge';

export function useRoles(enabled: boolean) {
  const transform = useMemo(
    () => (items: K8sResource[]) => {
      return items.map((item) => {
        const rItem = item as unknown as {
          metadata?: K8sResource['metadata'];
          rules?: RoleRule[];
        };

        const name = rItem.metadata?.name || '';
        const ns = rItem.metadata?.namespace || '';
        const creationTimestamp = rItem.metadata?.creationTimestamp || '';

        return {
          id: `${ns}/${name}`,
          name,
          ns,
          age: formatAge(creationTimestamp),
          createdTime: creationTimestamp ? new Date(creationTimestamp).toLocaleString() : '',
          labels: rItem.metadata?.labels,
          annotations: rItem.metadata?.annotations,
          rules: rItem.rules || [],
          rawItem: item
        };
      });
    },
    []
  );

  return useKubeQuery<RoleData>(K8S_RESOURCE_KEYS.ROLES, transform, enabled);
}
