import { useMemo } from 'react';
import { useKubeQuery } from './useKubeQuery';
import { type PodData } from '../types/PodData';
import { type PodResource, type ContainerStatus } from '../types/PodResource';
import { type K8sResource } from '../types/K8sResource';
import { formatAge } from '../utils/formatAge';

export function usePods(enabled: boolean) {
  const transform = useMemo(
    () => (items: K8sResource[], extraData: unknown) => {
      const topPodsItems =
        (extraData as { namespace: string; name: string; cpu: string; memory: string }[]) || [];
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

        const podMetric = topPodsItems.find((p) => p.name === name && p.namespace === ns);

        let cpuDisplay = 'N/A';
        if (podMetric && podMetric.cpu) {
          const rawCpu = podMetric.cpu.trim();
          if (rawCpu.endsWith('m')) {
            const millicores = parseInt(rawCpu.slice(0, -1), 10);
            cpuDisplay = (millicores / 1000).toFixed(3);
          } else {
            const cores = parseFloat(rawCpu);
            cpuDisplay = isNaN(cores) ? 'N/A' : cores.toFixed(3);
          }
        }

        let memDisplay = 'N/A';
        if (podMetric && podMetric.memory) {
          const rawMem = podMetric.memory.trim();
          if (rawMem.match(/[KMG]i$/)) {
            memDisplay = rawMem + 'B';
          } else {
            memDisplay = rawMem;
          }
        }

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
            if (terminated) {
              return terminated.exitCode !== 0;
            }
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
          cpu: cpuDisplay,
          memory: memDisplay,
          containers,
          controlledBy,
          node,
          qos,
          hasWarning
        };
      });
    },
    []
  );

  const fetchExtraData = useMemo(
    () => async (configPath: string | undefined, cluster: string, ns: string) => {
      try {
        const topPodsRes = await window.kuberneter.getTopPods(configPath, cluster, ns);
        return topPodsRes?.items || [];
      } catch (e) {
        console.warn('Failed to fetch top pods', e);
        return [];
      }
    },
    []
  );

  return useKubeQuery<PodData>('pods', transform, enabled, fetchExtraData);
}
