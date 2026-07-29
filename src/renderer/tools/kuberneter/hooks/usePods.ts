import { useMemo } from 'react';
import { useKubeQuery } from './useKubeQuery';
import { K8S_RESOURCE_KEYS } from '../constants/k8sResources';
import { useInstantMetrics, formatInstantCpu, formatInstantMemory } from './useMetrics';
import { type PodData } from '../types/PodData';
import { type PodResource, type ContainerStatus } from '../types/PodResource';
import { type K8sResource } from '../types/K8sResource';
import { formatAge } from '../utils/formatAge';

export function usePods(enabled: boolean) {
  const metricsQuery = useInstantMetrics(enabled);

  const transform = useMemo(
    () => (items: K8sResource[]) => {
      const metricItems = metricsQuery.data ?? [];

      return items.map((item) => {
        const podItem = item as unknown as PodResource;
        const name = podItem.metadata?.name || '';
        const ns = podItem.metadata?.namespace || '';

        const initContainerStatuses = podItem.status?.initContainerStatuses || [];
        const containerStatuses = podItem.status?.containerStatuses || [];
        const restarts = [...initContainerStatuses, ...containerStatuses].reduce(
          (acc: number, c) => acc + (c.restartCount || 0),
          0
        );

        const podMetric = metricItems.find((p) => p.name === name && p.namespace === ns);

        const cpu = podMetric?.cpu ? formatInstantCpu(podMetric.cpu) : 'N/A';
        const memory = podMetric?.memory ? formatInstantMemory(podMetric.memory) : 'N/A';

        const containers = containerStatuses.map((c: ContainerStatus) => ({
          name: c.name,
          ready: !!c.ready
        }));

        const ownerRefs = podItem.metadata?.ownerReferences || [];
        const controlledBy = ownerRefs.length > 0 ? ownerRefs[0].kind : '';

        const node = podItem.spec?.nodeName || '';
        const qos = podItem.status?.qosClass || '';
        const phase = podItem.status?.phase || 'Unknown';

        let hasWarning = phase !== 'Running' && phase !== 'Succeeded';
        if (!hasWarning) {
          const allStatuses = [...initContainerStatuses, ...containerStatuses];
          hasWarning = allStatuses.some((c: ContainerStatus) => {
            const waiting = c.state?.waiting;
            const terminated = c.state?.terminated;
            if (waiting) {
              const badReasons = [
                'CrashLoopBackOff',
                'ImagePullBackOff',
                'ErrImagePull',
                'CreateContainerConfigError',
                'CreateContainerError',
                'InvalidImageName'
              ];
              return waiting.reason && badReasons.includes(waiting.reason);
            }
            if (terminated) return terminated.exitCode !== 0;
            return false;
          });
        }

        return {
          id: `${ns}/${name}`,
          name,
          ns,
          status: phase,
          restarts,
          age: formatAge(item.metadata?.creationTimestamp || ''),
          rawAge: new Date(item.metadata?.creationTimestamp || Date.now()).getTime().toString(),
          cpu,
          memory,
          containers,
          controlledBy,
          node,
          qos,
          hasWarning,
          rawItem: item
        };
      });
    },
    [metricsQuery.data]
  );

  return useKubeQuery<PodData>(K8S_RESOURCE_KEYS.PODS, transform, enabled);
}
