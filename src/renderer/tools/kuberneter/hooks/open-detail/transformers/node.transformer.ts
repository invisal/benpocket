import { formatAge } from '../../../utils/formatAge';
import { type NodeData } from '../../../types/NodeData';
import { type K8sResource } from '../../../types/K8sResource';

export function buildNodeDetailPayload(name: string, rawResource?: K8sResource): NodeData {
  const item = rawResource;
  const creationTimestamp = item?.metadata?.creationTimestamp || '';
  const conditions =
    (item?.status?.conditions as Array<{
      type?: string;
      status?: string;
      message?: string;
    }>) || [];
  const readyCondition = conditions.find((c) => c.type === 'Ready');
  const conditionsStr =
    readyCondition?.status === 'True' ? 'Ready' : readyCondition?.message || 'NotReady';
  const badConditions = ['MemoryPressure', 'DiskPressure', 'PIDPressure', 'NetworkUnavailable'];
  const hasWarning =
    readyCondition?.status !== 'True' ||
    conditions.some((c) => c.type && badConditions.includes(c.type) && c.status === 'True');
  const labels = item?.metadata?.labels || {};
  const roles = Object.keys(labels)
    .filter((k) => k.startsWith('node-role.kubernetes.io/'))
    .map((k) => k.replace('node-role.kubernetes.io/', ''))
    .join(', ');
  const version = (item?.status?.nodeInfo as { kubeletVersion?: string })?.kubeletVersion || '';
  const taints = ((item?.spec as { taints?: unknown[] })?.taints || []).length;
  const cap = (item?.status as { capacity?: Record<string, string> })?.capacity || {};
  const cpuCapRaw = cap.cpu || '0';
  const memCapRaw = cap.memory || '0';
  const diskCapRaw = cap['ephemeral-storage'] || '0';

  return {
    id: name,
    name,
    hasWarning,
    cpuPercent: 0,
    memoryPercent: 0,
    diskPercent: 0,
    taints,
    roles,
    version,
    age: formatAge(creationTimestamp),
    conditions: conditionsStr,
    cpuCapacity: cpuCapRaw,
    memoryCapacity: memCapRaw,
    diskCapacity: diskCapRaw,
    rawCpu: cpuCapRaw,
    rawMemory: memCapRaw,
    rawDisk: diskCapRaw,
    rawAge: new Date(creationTimestamp || Date.now()).getTime().toString(),
    rawConditions: conditions.map((c) => c.type || '').join(' ')
  };
}
