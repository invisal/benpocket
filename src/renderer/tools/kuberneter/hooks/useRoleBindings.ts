import { useMemo } from 'react';
import { useKubeQuery } from './useKubeQuery';
import { type RoleBindingData, type Subject, type RoleRef } from '../types/RoleBindingData';
import { type K8sResource } from '../types/K8sResource';
import { formatAge } from '../utils/formatAge';

export function useRoleBindings(enabled: boolean) {
  const transform = useMemo(
    () => (items: K8sResource[]) => {
      return items.map((item) => {
        const rbItem = item as unknown as {
          metadata?: K8sResource['metadata'];
          roleRef?: RoleRef;
          subjects?: Subject[];
        };

        const name = rbItem.metadata?.name || '';
        const ns = rbItem.metadata?.namespace || '';
        const creationTimestamp = rbItem.metadata?.creationTimestamp || '';

        return {
          id: `${ns}/${name}`,
          name,
          ns,
          age: formatAge(creationTimestamp),
          createdTime: creationTimestamp ? new Date(creationTimestamp).toLocaleString() : '',
          labels: rbItem.metadata?.labels,
          annotations: rbItem.metadata?.annotations,
          roleRef: rbItem.roleRef,
          subjects: rbItem.subjects || [],
          rawItem: item
        };
      });
    },
    []
  );

  return useKubeQuery<RoleBindingData>('rolebindings', transform, enabled);
}
