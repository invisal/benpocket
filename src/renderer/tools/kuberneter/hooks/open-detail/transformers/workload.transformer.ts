import { formatAge } from '../../../utils/formatAge';
import { type DeployData } from '../../../types/DeployData';
import { type DaemonSetData } from '../../../types/DaemonSetData';
import { type StatefulSetData } from '../../../types/StatefulSetData';
import { type ReplicaSetData } from '../../../types/ReplicaSetData';
import { type JobData } from '../../../types/JobData';
import { type CronJobData } from '../../../types/CronJobData';
import { type K8sResource } from '../../../types/K8sResource';

export function buildDeploymentDetailPayload(
  name: string,
  namespace: string,
  rawResource?: K8sResource
): DeployData {
  const deployItem = rawResource;
  const replicas = (deployItem?.spec?.replicas as number) ?? 0;
  const readyReplicas = (deployItem?.status?.readyReplicas as number) ?? 0;
  const upToDate = (deployItem?.status?.updatedReplicas as number) ?? 0;
  const available = (deployItem?.status?.availableReplicas as number) ?? 0;
  const creationTimestamp = deployItem?.metadata?.creationTimestamp || '';

  return {
    id: `${namespace}/${name}`,
    name,
    ns: namespace,
    ready: `${readyReplicas}/${replicas}`,
    replicas,
    upToDate,
    available,
    age: formatAge(creationTimestamp),
    rawAge: new Date(creationTimestamp || Date.now()).getTime().toString(),
    status: readyReplicas === replicas ? 'Ready' : 'Progressing',
    strategy: (deployItem?.spec?.strategy as { type?: string })?.type || 'RollingUpdate',
    hasWarning: readyReplicas < replicas,
    rawItem: deployItem
  };
}

export function buildDaemonSetDetailPayload(
  name: string,
  namespace: string,
  rawResource?: K8sResource
): DaemonSetData {
  const item = rawResource;
  const desired = (item?.status?.desiredNumberScheduled as number) ?? 0;
  const current = (item?.status?.currentNumberScheduled as number) ?? 0;
  const ready = (item?.status?.numberReady as number) ?? 0;
  const upToDate = (item?.status?.updatedNumberScheduled as number) ?? 0;
  const available = (item?.status?.numberAvailable as number) ?? 0;
  const creationTimestamp = item?.metadata?.creationTimestamp || '';
  const matchLabels = (item?.spec?.selector as { matchLabels?: Record<string, string> })
    ?.matchLabels;

  return {
    id: `${namespace}/${name}`,
    name,
    ns: namespace,
    desired,
    current,
    ready,
    upToDate,
    available,
    age: formatAge(creationTimestamp),
    rawAge: new Date(creationTimestamp || Date.now()).getTime().toString(),
    createdTime: creationTimestamp ? new Date(creationTimestamp).toLocaleString() : '',
    nodeSelector: Object.entries(
      ((item?.spec?.template as { spec?: { nodeSelector?: Record<string, string> } })?.spec
        ?.nodeSelector as Record<string, string>) || {}
    )
      .map(([k, v]) => `${k}=${v}`)
      .join(', '),
    hasWarning: ready < desired,
    labels: item?.metadata?.labels,
    annotations: item?.metadata?.annotations,
    selector: matchLabels,
    rawItem: item
  };
}

export function buildStatefulSetDetailPayload(
  name: string,
  namespace: string,
  rawResource?: K8sResource
): StatefulSetData {
  const item = rawResource;
  const replicas = (item?.spec?.replicas as number) ?? 0;
  const readyReplicas = (item?.status?.readyReplicas as number) ?? 0;
  const creationTimestamp = item?.metadata?.creationTimestamp || '';
  const matchLabels = (item?.spec?.selector as { matchLabels?: Record<string, string> })
    ?.matchLabels;

  return {
    id: `${namespace}/${name}`,
    name,
    ns: namespace,
    replicas,
    ready: `${readyReplicas}/${replicas}`,
    age: formatAge(creationTimestamp),
    rawAge: new Date(creationTimestamp || Date.now()).getTime().toString(),
    createdTime: creationTimestamp ? new Date(creationTimestamp).toLocaleString() : '',
    hasWarning: readyReplicas < replicas,
    labels: item?.metadata?.labels,
    annotations: item?.metadata?.annotations,
    selector: matchLabels,
    rawItem: item
  };
}

export function buildReplicaSetDetailPayload(
  name: string,
  namespace: string,
  rawResource?: K8sResource
): ReplicaSetData {
  const item = rawResource;
  const desired = (item?.spec?.replicas as number) ?? 0;
  const current = (item?.status?.replicas as number) ?? 0;
  const ready = (item?.status?.readyReplicas as number) ?? 0;
  const creationTimestamp = item?.metadata?.creationTimestamp || '';
  const ownerRef = item?.metadata?.ownerReferences?.[0];
  const controlledBy = ownerRef?.name
    ? { kind: ownerRef.kind || 'Deployment', name: ownerRef.name }
    : undefined;
  const matchLabels = (item?.spec?.selector as { matchLabels?: Record<string, string> })
    ?.matchLabels;

  return {
    id: `${namespace}/${name}`,
    name,
    ns: namespace,
    desired,
    current,
    ready,
    age: formatAge(creationTimestamp),
    rawAge: new Date(creationTimestamp || Date.now()).getTime().toString(),
    createdTime: creationTimestamp ? new Date(creationTimestamp).toLocaleString() : '',
    hasWarning: ready < desired,
    labels: item?.metadata?.labels,
    annotations: item?.metadata?.annotations,
    selector: matchLabels,
    controlledBy,
    rawItem: item
  };
}

export function buildJobDetailPayload(
  name: string,
  namespace: string,
  rawResource?: K8sResource
): JobData {
  const item = rawResource;
  const desired = (item?.spec?.completions as number) ?? 1;
  const succeeded = (item?.status?.succeeded as number) ?? 0;
  const failed = (item?.status?.failed as number) ?? 0;
  const conditions = (item?.status?.conditions as Array<{ type?: string; status?: string }>) || [];
  const condStr =
    conditions
      .filter((c) => c.status === 'True')
      .map((c) => c.type)
      .join(', ') || (succeeded > 0 ? 'Complete' : failed > 0 ? 'Failed' : 'Running');
  const creationTimestamp = item?.metadata?.creationTimestamp || '';
  const ownerRef = item?.metadata?.ownerReferences?.[0];
  const controlledBy = ownerRef?.name
    ? { kind: ownerRef.kind || 'CronJob', name: ownerRef.name }
    : undefined;
  const matchLabels = (item?.spec?.selector as { matchLabels?: Record<string, string> })
    ?.matchLabels;

  return {
    id: `${namespace}/${name}`,
    name,
    ns: namespace,
    completions: `${succeeded}/${desired}`,
    succeeded,
    desired,
    age: formatAge(creationTimestamp),
    rawAge: new Date(creationTimestamp || Date.now()).getTime().toString(),
    createdTime: creationTimestamp ? new Date(creationTimestamp).toLocaleString() : '',
    conditions: condStr,
    hasWarning: failed > 0,
    labels: item?.metadata?.labels,
    annotations: item?.metadata?.annotations,
    selector: matchLabels,
    controlledBy,
    rawItem: item
  };
}

export function buildCronJobDetailPayload(
  name: string,
  namespace: string,
  rawResource?: K8sResource
): CronJobData {
  const item = rawResource;
  const schedule = (item?.spec?.schedule as string) || '-';
  const suspend = (item?.spec?.suspend as boolean) ?? false;
  const rawActive = item?.status?.active as unknown;
  const active = Array.isArray(rawActive) ? rawActive.length : 0;
  const timeZone = (item?.spec?.timeZone as string) || '-';
  const lastScheduleTime = item?.status?.lastScheduleTime as string | undefined;
  const lastSchedule = lastScheduleTime ? formatAge(lastScheduleTime) : '-';
  const nextExecution = suspend ? 'N/A' : '-';
  const creationTimestamp = item?.metadata?.creationTimestamp || '';

  return {
    id: `${namespace}/${name}`,
    name,
    ns: namespace,
    schedule,
    suspend,
    active,
    lastSchedule,
    nextExecution,
    timeZone,
    age: formatAge(creationTimestamp),
    rawAge: new Date(creationTimestamp || Date.now()).getTime().toString(),
    hasWarning: active > 0 && suspend,
    rawItem: item
  };
}
