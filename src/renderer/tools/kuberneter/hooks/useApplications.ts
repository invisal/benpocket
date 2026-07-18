import { useMemo } from 'react';
import { useKubeQuery } from './useKubeQuery';
import { type ApplicationData } from '../types/ApplicationData';
import { type K8sResource } from '../types/K8sResource';
import { formatAgeLong } from '../utils/formatAgeLong';

export function useApplications(enabled: boolean) {
  const transform = useMemo(
    () => (items: K8sResource[]) => {
      return items
        .map((item) => {
          const name = item.metadata?.name || '';
          const ns = item.metadata?.namespace || '';
          const kind = item.kind || '';
          const labels = item.metadata?.labels || {};
          const annotations = item.metadata?.annotations || {};

          const hasAppLabel =
            labels['app.kubernetes.io/name'] ||
            labels['app.kubernetes.io/instance'] ||
            labels['app.kubernetes.io/part-of'] ||
            labels['app.kubernetes.io/managed-by'];

          if (!hasAppLabel) {
            return null;
          }

          const instance =
            labels['app.kubernetes.io/instance'] || labels['app.kubernetes.io/part-of'] || name;
          const application =
            labels['app.kubernetes.io/name'] || labels['app.kubernetes.io/part-of'] || name;
          const managedBy =
            labels['app.kubernetes.io/managed-by'] ||
            (annotations['meta.helm.sh/release-name'] ? 'Helm' : '');
          const version = labels['app.kubernetes.io/version'] || '';
          const age = formatAgeLong(item.metadata?.creationTimestamp || '');

          let status: 'Running' | 'Pending' = 'Pending';
          if (kind === 'Deployment') {
            const replicas = item.status?.replicas || 0;
            const readyReplicas = item.status?.readyReplicas || 0;
            status = replicas > 0 && readyReplicas === replicas ? 'Running' : 'Pending';
          } else if (kind === 'StatefulSet') {
            const replicas = item.status?.replicas || 0;
            const readyReplicas = item.status?.readyReplicas || 0;
            status = replicas > 0 && readyReplicas === replicas ? 'Running' : 'Pending';
          } else if (kind === 'DaemonSet') {
            const desired = item.status?.desiredNumberScheduled || 0;
            const ready = item.status?.numberReady || 0;
            status = desired > 0 && ready === desired ? 'Running' : 'Pending';
          }

          return {
            id: `${ns}/${kind}/${name}`,
            instance,
            application,
            namespace: ns,
            managedBy,
            version,
            age,
            status,
            kind,
            creationTimestamp: item.metadata?.creationTimestamp || ''
          };
        })
        .filter((x): x is ApplicationData => x !== null);
    },
    []
  );

  return useKubeQuery<ApplicationData>('deployments,statefulsets,daemonsets', transform, enabled);
}
