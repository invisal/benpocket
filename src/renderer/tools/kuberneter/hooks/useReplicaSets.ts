import { useMemo } from 'react';
import { useKubeQuery } from './useKubeQuery';
import { type ReplicaSetData } from '../types/ReplicaSetData';
import { type K8sResource } from '../types/K8sResource';
import { formatAge } from '../utils/formatAge';

export function useReplicaSets(enabled: boolean) {
  const transform = useMemo(
    () => (items: K8sResource[]) => {
      return items.map((item) => {
        const name = item.metadata?.name || '';
        const ns = item.metadata?.namespace || '';
        const desired = item.spec?.replicas ?? 0;
        const current = item.status?.replicas ?? 0;
        const ready = item.status?.readyReplicas ?? 0;
        const hasWarning = desired > 0 && ready < desired;

        return {
          id: `${ns}/${name}`,
          name,
          ns,
          desired,
          current,
          ready,
          age: formatAge(item.metadata?.creationTimestamp || ''),
          rawAge: new Date(item.metadata?.creationTimestamp || Date.now()).getTime().toString(),
          hasWarning
        };
      });
    },
    []
  );

  return useKubeQuery<ReplicaSetData>('replicasets', transform, enabled);
}
