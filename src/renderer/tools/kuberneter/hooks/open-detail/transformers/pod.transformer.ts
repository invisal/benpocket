import { formatAge } from '../../../utils/formatAge';
import { type PodData } from '../../../types/PodData';
import { type PodResource, type ContainerStatus } from '../../../types/PodResource';
import { type K8sResource } from '../../../types/K8sResource';

export function buildPodDetailPayload(
  name: string,
  namespace: string,
  rawResource?: K8sResource
): PodData {
  const podItem = rawResource as unknown as PodResource;
  const initContainerStatuses = podItem?.status?.initContainerStatuses || [];
  const containerStatuses = podItem?.status?.containerStatuses || [];
  const restarts = [...initContainerStatuses, ...containerStatuses].reduce(
    (acc: number, c) => acc + (c.restartCount || 0),
    0
  );
  const containers = containerStatuses.map((c: ContainerStatus) => ({
    name: c.name,
    ready: !!c.ready
  }));
  const ownerRefs = podItem?.metadata?.ownerReferences || [];
  const controlledBy = ownerRefs.length > 0 ? ownerRefs[0].kind : '';
  const node = podItem?.spec?.nodeName || '';
  const qos = podItem?.status?.qosClass || '';
  const phase = podItem?.status?.phase || 'Unknown';
  const creationTimestamp = podItem?.metadata?.creationTimestamp || '';

  return {
    id: `${namespace}/${name}`,
    name,
    ns: namespace,
    status: phase,
    restarts,
    age: formatAge(creationTimestamp),
    rawAge: new Date(creationTimestamp || Date.now()).getTime().toString(),
    controlledBy,
    node,
    qos,
    cpu: 'N/A',
    memory: 'N/A',
    containers,
    hasWarning: phase !== 'Running' && phase !== 'Succeeded',
    rawItem: podItem as unknown as K8sResource
  };
}
