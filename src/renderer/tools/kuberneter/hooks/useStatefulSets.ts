import { useMemo } from 'react';
import { useKubeQuery } from './useKubeQuery';
import { type StatefulSetData } from '../types/StatefulSetData';
import { type K8sResource } from '../types/K8sResource';
import { formatAge } from '../utils/formatAge';

export function useStatefulSets(enabled: boolean) {
  const transform = useMemo(
    () => (items: K8sResource[]) => {
      return items.map((item) => {
        const name = item.metadata?.name || '';
        const ns = item.metadata?.namespace || '';
        const replicas = item.spec?.replicas ?? 0;
        const readyReplicas = item.status?.readyReplicas ?? 0;
        const hasWarning = replicas > 0 && readyReplicas < replicas;

        return {
          id: `${ns}/${name}`,
          name,
          ns,
          ready: `${readyReplicas}/${replicas}`,
          replicas,
          age: formatAge(item.metadata?.creationTimestamp || ''),
          rawAge: new Date(item.metadata?.creationTimestamp || Date.now()).getTime().toString(),
          hasWarning
        };
      });
    },
    []
  );

  return useKubeQuery<StatefulSetData>('statefulsets', transform, enabled);
}
