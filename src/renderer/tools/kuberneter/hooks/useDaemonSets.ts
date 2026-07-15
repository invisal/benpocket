import { useMemo } from 'react';
import { useKubeQuery } from './useKubeQuery';
import { type DaemonSetData } from '../types/DaemonSetData';
import { type K8sResource } from '../types/K8sResource';
import { formatAge } from '../utils/formatAge';

export function useDaemonSets(enabled: boolean) {
  const transform = useMemo(
    () => (items: K8sResource[]) => {
      return items.map((item) => {
        const dsItem = item;
        const name = dsItem.metadata?.name || '';
        const ns = dsItem.metadata?.namespace || '';
        const desired = dsItem.status?.desiredNumberScheduled ?? 0;
        const current = dsItem.status?.currentNumberScheduled ?? 0;
        const ready = dsItem.status?.numberReady ?? 0;
        const upToDate = dsItem.status?.updatedNumberScheduled ?? 0;
        const available = dsItem.status?.numberAvailable ?? 0;

        const nodeSelectorObj = dsItem.spec?.template?.spec?.nodeSelector || {};
        const nodeSelector =
          Object.entries(nodeSelectorObj)
            .map(([k, v]) => `${k}=${v}`)
            .join(', ') || '';

        const hasWarning = desired > 0 && available < desired;

        return {
          id: `${ns}/${name}`,
          name,
          ns,
          desired,
          current,
          ready,
          upToDate,
          available,
          nodeSelector,
          age: formatAge(dsItem.metadata?.creationTimestamp || ''),
          rawAge: new Date(dsItem.metadata?.creationTimestamp || Date.now()).getTime().toString(),
          hasWarning
        };
      });
    },
    []
  );

  return useKubeQuery<DaemonSetData>('daemonsets', transform, enabled);
}
