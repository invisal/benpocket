import { formatAge } from '../../../utils/formatAge';
import { type PersistentVolumeClaimData } from '../../../types/PersistentVolumeClaimData';
import { type K8sResource } from '../../../types/K8sResource';

export function buildPvcDetailPayload(
  name: string,
  namespace: string,
  rawResource?: K8sResource
): PersistentVolumeClaimData {
  const item = rawResource as unknown as {
    metadata?: {
      creationTimestamp?: string;
      labels?: Record<string, string>;
      annotations?: Record<string, string>;
      finalizers?: string[];
    };
    spec?: {
      accessModes?: string[];
      storageClassName?: string;
      volumeName?: string;
      resources?: { requests?: { storage?: string } };
    };
    status?: {
      phase?: string;
      capacity?: { storage?: string };
    };
  };
  const creationTimestamp = item?.metadata?.creationTimestamp || '';
  const status = item?.status?.phase || 'Pending';
  const capacity =
    item?.status?.capacity?.storage || item?.spec?.resources?.requests?.storage || '—';
  const accessModes = item?.spec?.accessModes || [];
  const storageClass = item?.spec?.storageClassName || '—';
  const volume = item?.spec?.volumeName || '—';

  return {
    id: `${namespace}/${name}`,
    name,
    ns: namespace,
    status,
    volume,
    capacity,
    storageClass,
    accessModes,
    age: formatAge(creationTimestamp),
    createdTime: creationTimestamp ? new Date(creationTimestamp).toLocaleString() : '',
    labels: item?.metadata?.labels,
    annotations: item?.metadata?.annotations,
    finalizers: item?.metadata?.finalizers,
    pods: [],
    rawItem: rawResource
  };
}
