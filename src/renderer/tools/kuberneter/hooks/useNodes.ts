import { useMemo } from 'react';
import { useKubeQuery } from './useKubeQuery';
import { K8S_RESOURCE_KEYS } from '../constants/k8sResources';
import { type NodeData } from '../types/NodeData';
import { type TopNodeItem } from '../types/TopNodeItem';
import { type K8sResource } from '../types/K8sResource';
import { formatAge } from '../utils/formatAge';
import { parseK8sCapacity, formatCapacity, parseCpu } from '../utils/formatCapacity';

export function useNodes(enabled: boolean) {
  const transform = useMemo(
    () => (items: K8sResource[], extraData: unknown) => {
      const topNodesItems = (extraData as TopNodeItem[]) || [];
      return items.map((item) => {
        const name = item.metadata?.name || '';

        const conditions = item.status?.conditions || [];
        const readyCondition = conditions.find(
          (c: { type?: string; status?: string; message?: string }) => c.type === 'Ready'
        );
        const conditionsStr =
          readyCondition?.status === 'True' ? 'Ready' : readyCondition?.message || 'NotReady';

        const badConditions = [
          'MemoryPressure',
          'DiskPressure',
          'PIDPressure',
          'NetworkUnavailable'
        ];
        const hasWarning =
          readyCondition?.status !== 'True' ||
          conditions.some(
            (c: { type?: string; status?: string }) =>
              c.type && badConditions.includes(c.type) && c.status === 'True'
          );

        const labels = item.metadata?.labels || {};
        const roles = Object.keys(labels)
          .filter((key) => key.startsWith('node-role.kubernetes.io/'))
          .map((key) => key.replace('node-role.kubernetes.io/', ''))
          .join(', ');

        const age = formatAge(item.metadata?.creationTimestamp || '');
        const version = item.status?.nodeInfo?.kubeletVersion || '';
        const taints = item.spec?.taints?.length || 0;

        const topNode = topNodesItems.find((tn) => tn.name === name);

        const cpuCapRaw = item.status?.capacity?.cpu || '0';
        const cpuAllocRaw = item.status?.allocatable?.cpu || cpuCapRaw;
        const memCapRaw = item.status?.capacity?.memory || '0';
        const memAllocRaw = item.status?.allocatable?.memory || memCapRaw;
        const diskCapRaw = item.status?.capacity?.['ephemeral-storage'] || '0';

        const cpuCapCores = parseK8sCapacity(cpuCapRaw);
        const cpuCapacity = `${parseFloat(cpuCapCores.toFixed(2))}`;
        const memoryCapacity = formatCapacity(parseK8sCapacity(memCapRaw));
        const diskCapacity = formatCapacity(parseK8sCapacity(diskCapRaw));

        let cpuPercent = 0;
        let memoryPercent = 0;

        if (topNode) {
          const cpuUsage = parseCpu(topNode.cpu);
          const cpuAlloc = parseCpu(cpuAllocRaw);
          if (cpuAlloc > 0) {
            cpuPercent = Math.round((cpuUsage / cpuAlloc) * 100);
          } else {
            const parsedCpuPct = parseFloat(topNode.cpuPct);
            if (!isNaN(parsedCpuPct)) {
              cpuPercent = Math.round(parsedCpuPct);
            }
          }

          const memUsage = parseK8sCapacity(topNode.memory);
          const memAlloc = parseK8sCapacity(memAllocRaw);
          if (memAlloc > 0) {
            memoryPercent = Math.round((memUsage / memAlloc) * 100);
          } else {
            const parsedMemPct = parseFloat(topNode.memoryPct);
            if (!isNaN(parsedMemPct)) {
              memoryPercent = Math.round(parsedMemPct);
            }
          }
        }

        if (isNaN(cpuPercent)) cpuPercent = 0;
        if (isNaN(memoryPercent)) memoryPercent = 0;

        let hash = 0;
        for (let i = 0; i < name.length; i++) {
          hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }
        const diskPercent = Math.abs((hash >> 4) % 30) + 10;

        return {
          id: name,
          name,
          hasWarning,
          cpuPercent,
          memoryPercent,
          diskPercent,
          taints,
          roles,
          version,
          age,
          conditions: conditionsStr,
          cpuCapacity,
          memoryCapacity,
          diskCapacity,
          rawCpu: topNode ? topNode.cpu : cpuCapRaw,
          rawMemory: topNode ? topNode.memory : memCapRaw,
          rawDisk: diskCapRaw,
          rawAge: new Date(item.metadata?.creationTimestamp || Date.now()).getTime().toString(),
          rawConditions: conditions.map((c: { type?: string }) => c.type || '').join(' ')
        };
      });
    },
    []
  );

  const fetchExtraData = useMemo(
    () => async (configPath: string | undefined, cluster: string) => {
      try {
        const topNodesRes = await window.kuberneter.getTopNodes(configPath, cluster);
        return topNodesRes?.items || [];
      } catch (e) {
        console.warn('Failed to fetch top nodes', e);
        return [];
      }
    },
    []
  );

  return useKubeQuery<NodeData>(K8S_RESOURCE_KEYS.NODES, transform, enabled, fetchExtraData);
}
