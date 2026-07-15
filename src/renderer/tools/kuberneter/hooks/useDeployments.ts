import { useMemo } from 'react';
import { useKubeQuery } from './useKubeQuery';
import { type DeployData } from '../types/DeployData';
import { type K8sResource } from '../types/K8sResource';
import { formatAge } from '../utils/formatAge';

export function useDeployments(enabled: boolean) {
  const transform = useMemo(
    () => (items: K8sResource[]) => {
      return items.map((item) => {
        const deployItem = item;
        const name = deployItem.metadata?.name || '';
        const ns = deployItem.metadata?.namespace || '';
        const replicas = deployItem.spec?.replicas ?? 0;
        const readyReplicas = deployItem.status?.readyReplicas ?? 0;
        const upToDate = deployItem.status?.updatedReplicas ?? 0;
        const available = deployItem.status?.availableReplicas ?? 0;

        let status = 'Pending';
        if (replicas > 0 && readyReplicas === replicas) {
          status = 'Running';
        }

        const hasWarning = replicas > 0 && available < replicas;
        const strategy = deployItem.spec?.strategy?.type || 'RollingUpdate';

        return {
          id: `${ns}/${name}`,
          name,
          ns,
          ready: `${readyReplicas}/${replicas}`,
          upToDate,
          available,
          age: formatAge(deployItem.metadata?.creationTimestamp || ''),
          rawAge: new Date(deployItem.metadata?.creationTimestamp || Date.now())
            .getTime()
            .toString(),
          replicas,
          status,
          hasWarning,
          strategy
        };
      });
    },
    []
  );

  return useKubeQuery<DeployData>('deployments', transform, enabled);
}
