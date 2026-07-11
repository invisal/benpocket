import { useState, useEffect } from 'react';
import { useLayoutStore } from '../../../../src/store/layout.store';
import { PodData } from '../../types/PodData';
import { DeployData } from '../../types/DeployData';
import { ServiceData } from '../../types/ServiceData';
import { ConfigMapData } from '../../types/ConfigMapData';
import { ApplicationData } from '../../types/ApplicationData';
import { K8sResource } from '../../types/K8sResource';
import { formatAge } from '../../ults/formatAge';
import { formatAgeLong } from '../../ults/formatAgeLong';

export function useWorkspaceResources(resource: string) {
  const activeInstanceId = useLayoutStore((s) => s.activeInstanceId);
  const kuberneterSelectedCluster = useLayoutStore(
    (s) => s.kuberneterInstanceCluster[activeInstanceId] || ''
  );
  const kuberneterSelectedNamespace = useLayoutStore(
    (s) => s.kuberneterInstanceNamespace[activeInstanceId] || 'All Namespaces'
  );
  const activeConfigPath = useLayoutStore(
    (s) => s.kuberneterInstanceConfigPath[activeInstanceId] || 'default'
  );

  const [podsData, setPodsData] = useState<PodData[]>([]);
  const [deploysData, setDeploysData] = useState<DeployData[]>([]);
  const [servicesData, setServicesData] = useState<ServiceData[]>([]);
  const [configMapsData, setConfigMapsData] = useState<ConfigMapData[]>([]);
  const [applicationsData, setApplicationsData] = useState<ApplicationData[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchResources = async () => {
    if (resource === 'home' || !kuberneterSelectedCluster) return;

    setIsLoading(true);
    setErrorMsg(null);
    try {
      const configPathArg = activeConfigPath === 'default' ? undefined : activeConfigPath;

      let queryResource = '';
      if (resource === 'pods') queryResource = 'pods';
      else if (resource === 'deployments') queryResource = 'deployments';
      else if (resource === 'services') queryResource = 'services';
      else if (resource === 'configmaps') queryResource = 'configmaps';
      else if (resource === 'apps') queryResource = 'deployments,statefulsets,daemonsets';
      else return;

      const res = await window.kuberneter.getResources(
        configPathArg,
        kuberneterSelectedCluster,
        queryResource,
        kuberneterSelectedNamespace
      );

      if (res && res.error) {
        setErrorMsg(res.error);
        return;
      }

      const items = (res.items as K8sResource[]) || [];

      if (resource === 'pods') {
        const transformed = items.map((item) => {
          const containerStatuses = item.status?.containerStatuses || [];
          const restarts = containerStatuses.reduce(
            (acc: number, c) => acc + (c.restartCount || 0),
            0
          );
          return {
            name: item.metadata?.name || '',
            ns: item.metadata?.namespace || '',
            status: item.status?.phase || 'Unknown',
            restarts,
            age: formatAge(item.metadata?.creationTimestamp || '')
          };
        });
        setPodsData(transformed);
      } else if (resource === 'deployments') {
        const transformed = items.map((item) => {
          const replicas = item.status?.replicas || 0;
          const readyReplicas = item.status?.readyReplicas || 0;
          return {
            name: item.metadata?.name || '',
            ns: item.metadata?.namespace || '',
            ready: `${readyReplicas}/${replicas}`,
            upToDate: item.status?.updatedReplicas || 0,
            available: item.status?.availableReplicas || 0,
            age: formatAge(item.metadata?.creationTimestamp || '')
          };
        });
        setDeploysData(transformed);
      } else if (resource === 'services') {
        const transformed = items.map((item) => {
          const ports = item.spec?.ports?.map((p) => `${p.port}/${p.protocol}`).join(', ') || '';
          return {
            name: item.metadata?.name || '',
            ns: item.metadata?.namespace || '',
            type: item.spec?.type || 'ClusterIP',
            clusterIp: item.spec?.clusterIP || '',
            ports,
            age: formatAge(item.metadata?.creationTimestamp || '')
          };
        });
        setServicesData(transformed);
      } else if (resource === 'configmaps') {
        const transformed = items.map((item) => {
          const keys = Object.keys(item.data || {}).length;
          return {
            name: item.metadata?.name || '',
            ns: item.metadata?.namespace || '',
            keys,
            age: formatAge(item.metadata?.creationTimestamp || '')
          };
        });
        setConfigMapsData(transformed);
      } else if (resource === 'apps') {
        const transformed = items
          .map((item) => {
            const name = item.metadata?.name || '';
            const ns = item.metadata?.namespace || '';
            const kind = item.kind || '';
            const labels = item.metadata?.labels || {};
            const annotations = item.metadata?.annotations || {};

            // Strict application check to match Lens IDE
            // We only check for recommended app.kubernetes.io/ labels
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
              kind
            };
          })
          .filter((x): x is ApplicationData => x !== null);
        setApplicationsData(transformed);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(msg || 'Failed to fetch cluster resources.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchResources();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resource, kuberneterSelectedCluster, kuberneterSelectedNamespace, activeConfigPath]);

  return {
    kuberneterSelectedCluster,
    kuberneterSelectedNamespace,
    podsData,
    deploysData,
    servicesData,
    configMapsData,
    applicationsData,
    isLoading,
    errorMsg
  };
}
