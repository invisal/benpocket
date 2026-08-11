import { useMemo, useCallback } from 'react';
import { useKubeQuery } from './useKubeQuery';
import { K8S_RESOURCE_KEYS } from '../constants/k8sResources';
import { type ApplicationData } from '../types/ApplicationData';
import { type K8sResource } from '../types/K8sResource';
import { formatAgeLong } from '../utils/formatAgeLong';

const createTransform = (defaultKind: 'Deployment' | 'StatefulSet' | 'DaemonSet') => {
  return (items: K8sResource[]) => {
    return items
      .map((item) => {
        const name = item.metadata?.name || '';
        const ns = item.metadata?.namespace || '';
        const kind = item.kind || defaultKind;
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
  };
};

export function useApplications(enabled: boolean) {
  const transformDeployments = useMemo(() => createTransform('Deployment'), []);
  const transformStatefulSets = useMemo(() => createTransform('StatefulSet'), []);
  const transformDaemonSets = useMemo(() => createTransform('DaemonSet'), []);

  const deploymentsQuery = useKubeQuery<ApplicationData>(
    K8S_RESOURCE_KEYS.DEPLOYMENTS,
    transformDeployments,
    enabled
  );
  const statefulSetsQuery = useKubeQuery<ApplicationData>(
    K8S_RESOURCE_KEYS.STATEFUL_SETS,
    transformStatefulSets,
    enabled
  );
  const daemonSetsQuery = useKubeQuery<ApplicationData>(
    K8S_RESOURCE_KEYS.DAEMON_SETS,
    transformDaemonSets,
    enabled
  );

  const data = useMemo(
    () => [...deploymentsQuery.data, ...statefulSetsQuery.data, ...daemonSetsQuery.data],
    [deploymentsQuery.data, statefulSetsQuery.data, daemonSetsQuery.data]
  );

  const isLoading =
    (deploymentsQuery.isLoading && deploymentsQuery.data.length === 0) ||
    (statefulSetsQuery.isLoading && statefulSetsQuery.data.length === 0) ||
    (daemonSetsQuery.isLoading && daemonSetsQuery.data.length === 0);

  const errorMsg =
    deploymentsQuery.errorMsg && statefulSetsQuery.errorMsg && daemonSetsQuery.errorMsg
      ? deploymentsQuery.errorMsg
      : null;

  const refetch = useCallback(() => {
    void deploymentsQuery.refetch();
    void statefulSetsQuery.refetch();
    void daemonSetsQuery.refetch();
  }, [deploymentsQuery, statefulSetsQuery, daemonSetsQuery]);

  return {
    data,
    isLoading,
    errorMsg,
    refetch
  };
}
