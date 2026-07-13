import { useState, useEffect, useCallback } from 'react';
import { useLayoutStore } from '../../../../../src/store/layout.store';
import { useKuberneterStore } from '../../../store/kuberneter.store';
import { PodData } from '../../../types/PodData';
import { DeployData } from '../../../types/DeployData';
import { DaemonSetData } from '../../../types/DaemonSetData';
import { StatefulSetData } from '../../../types/StatefulSetData';
import { ReplicaSetData } from '../../../types/ReplicaSetData';
import { JobData } from '../../../types/JobData';
import { CronJobData } from '../../../types/CronJobData';
import { EventData } from '../../../types/EventData';
import { K8sResource } from '../../../types/K8sResource';
import { formatAge } from '../../../ults/formatAge';
import { PodResource, ContainerStatus } from '../../../types/PodResource';

// ─── parsers ────────────────────────────────────────────────────────────────

function parsePods(items: K8sResource[]): PodData[] {
  return items.map((item) => {
    const pod = item as PodResource;
    const name = pod.metadata?.name || '';
    const ns = pod.metadata?.namespace || '';
    const status = pod.status?.phase || 'Unknown';
    const restarts =
      (pod.status?.containerStatuses as ContainerStatus[] | undefined)?.reduce(
        (sum, c) => sum + (c.restartCount || 0),
        0
      ) ?? 0;
    const ready =
      (pod.status?.containerStatuses as ContainerStatus[] | undefined)?.filter((c) => c.ready)
        .length ?? 0;
    const total = (pod.status?.containerStatuses as ContainerStatus[] | undefined)?.length ?? 0;
    const containers =
      (pod.status?.containerStatuses as ContainerStatus[] | undefined)?.map((c) => ({
        name: c.name || '',
        ready: c.ready || false
      })) ?? [];
    return {
      id: `${ns}/${name}`,
      name,
      ns,
      status,
      ready: `${ready}/${total}`,
      restarts,
      age: formatAge(pod.metadata?.creationTimestamp || ''),
      rawAge: new Date(pod.metadata?.creationTimestamp || Date.now()).getTime().toString(),
      hasWarning: status !== 'Running' && status !== 'Succeeded' && status !== 'Completed',
      cpu: '',
      memory: '',
      containers,
      controlledBy: '',
      node: '',
      qos: ''
    };
  });
}

function parseDeploys(items: K8sResource[]): DeployData[] {
  return items.map((item) => {
    const name = item.metadata?.name || '';
    const ns = item.metadata?.namespace || '';
    const desired = item.spec?.replicas ?? 0;
    const ready = item.status?.readyReplicas ?? 0;
    const updated = item.status?.updatedReplicas ?? 0;
    const available = item.status?.availableReplicas ?? 0;
    const strategy = item.spec?.strategy?.type || '';
    const hasWarning = ready < desired || available < desired;
    return {
      id: `${ns}/${name}`,
      name,
      ns,
      ready: `${ready}/${desired}`,
      upToDate: updated,
      available,
      age: formatAge(item.metadata?.creationTimestamp || ''),
      rawAge: new Date(item.metadata?.creationTimestamp || Date.now()).getTime().toString(),
      replicas: desired,
      status: hasWarning ? 'Degraded' : 'Available',
      hasWarning,
      strategy
    };
  });
}

function parseDaemonSets(items: K8sResource[]): DaemonSetData[] {
  return items.map((item) => {
    const name = item.metadata?.name || '';
    const ns = item.metadata?.namespace || '';
    const desired = item.status?.desiredNumberScheduled ?? 0;
    const ready = item.status?.numberReady ?? 0;
    const available = item.status?.numberAvailable ?? 0;
    const current = item.status?.currentNumberScheduled ?? 0;
    const upToDate = item.status?.updatedNumberScheduled ?? 0;
    const nodeSelector = item.spec?.template?.spec?.nodeSelector
      ? Object.entries(item.spec.template.spec.nodeSelector)
          .map(([k, v]) => `${k}=${v}`)
          .join(', ')
      : '';
    const hasWarning = ready < desired;
    return {
      id: `${ns}/${name}`,
      name,
      ns,
      desired,
      current,
      ready,
      upToDate,
      available,
      nodeSelector,
      age: formatAge(item.metadata?.creationTimestamp || ''),
      rawAge: new Date(item.metadata?.creationTimestamp || Date.now()).getTime().toString(),
      hasWarning
    };
  });
}

function parseStatefulSets(items: K8sResource[]): StatefulSetData[] {
  return items.map((item) => {
    const name = item.metadata?.name || '';
    const ns = item.metadata?.namespace || '';
    const desired = item.spec?.replicas ?? 0;
    const ready = item.status?.readyReplicas ?? 0;
    const hasWarning = ready < desired;
    return {
      id: `${ns}/${name}`,
      name,
      ns,
      ready: `${ready}/${desired}`,
      replicas: desired,
      age: formatAge(item.metadata?.creationTimestamp || ''),
      rawAge: new Date(item.metadata?.creationTimestamp || Date.now()).getTime().toString(),
      hasWarning
    };
  });
}

function parseReplicaSets(items: K8sResource[]): ReplicaSetData[] {
  return items.map((item) => {
    const name = item.metadata?.name || '';
    const ns = item.metadata?.namespace || '';
    const desired = item.spec?.replicas ?? 0;
    const ready = item.status?.readyReplicas ?? 0;
    const current = item.status?.replicas ?? 0;
    const hasWarning = ready < desired;
    return {
      id: `${ns}/${name}`,
      name,
      ns,
      desired,
      current,
      ready,
      age: formatAge(item.metadata?.creationTimestamp || ''),
      rawAge: new Date(item.metadata?.creationTimestamp || Date.now()).getTime().toString(),
      hasWarning
    };
  });
}

function parseJobs(items: K8sResource[]): JobData[] {
  return items.map((item) => {
    const name = item.metadata?.name || '';
    const ns = item.metadata?.namespace || '';
    const desired = item.spec?.completions ?? 1;
    const succeeded = item.status?.succeeded ?? 0;
    const failed = item.status?.failed ?? 0;
    const conditions = item.status?.conditions || [];
    const condStr =
      conditions
        .filter((c) => c.status === 'True')
        .map((c) => c.type)
        .join(', ') || (succeeded > 0 ? 'Complete' : failed > 0 ? 'Failed' : 'Running');
    return {
      id: `${ns}/${name}`,
      name,
      ns,
      completions: `${succeeded}/${desired}`,
      succeeded,
      desired,
      age: formatAge(item.metadata?.creationTimestamp || ''),
      rawAge: new Date(item.metadata?.creationTimestamp || Date.now()).getTime().toString(),
      conditions: condStr,
      hasWarning: failed > 0
    };
  });
}

function parseCronJobs(items: K8sResource[]): CronJobData[] {
  return items.map((item) => {
    const name = item.metadata?.name || '';
    const ns = item.metadata?.namespace || '';
    const schedule = item.spec?.schedule || '-';
    const suspend = item.spec?.suspend ?? false;
    const active = item.status?.active ?? 0;
    const timeZone = item.spec?.timeZone || '-';
    const lastScheduleTime = item.status?.lastScheduleTime;
    const lastSchedule = lastScheduleTime ? formatAge(lastScheduleTime) : '-';
    const nextExecution = suspend ? 'N/A' : '-';
    return {
      id: `${ns}/${name}`,
      name,
      ns,
      schedule,
      suspend,
      active,
      lastSchedule,
      nextExecution,
      timeZone,
      age: formatAge(item.metadata?.creationTimestamp || ''),
      rawAge: new Date(item.metadata?.creationTimestamp || Date.now()).getTime().toString(),
      hasWarning: active > 0 && suspend
    };
  });
}

function parseEvents(items: K8sResource[]): EventData[] {
  return items.map((item, i) => {
    const name = item.metadata?.name || `event-${i}`;
    const ns = item.metadata?.namespace || '';
    const lastTs = item.lastTimestamp || item.metadata?.creationTimestamp || '';
    return {
      id: `${ns}/${name}`,
      type: item.type || 'Normal',
      source: item.source?.component || '-',
      ns,
      involvedObject: item.involvedObject?.name || '-',
      involvedKind: item.involvedObject?.kind || '-',
      message: item.message || '',
      count: item.count ?? 1,
      age: formatAge(item.metadata?.creationTimestamp || ''),
      lastSeen: formatAge(lastTs),
      rawLastSeen: new Date(lastTs || Date.now()).getTime()
    };
  });
}

// ─── hook ───────────────────────────────────────────────────────────────────

export interface WorkloadSummary {
  podsData: PodData[];
  deploysData: DeployData[];
  daemonSetsData: DaemonSetData[];
  statefulSetsData: StatefulSetData[];
  replicaSetsData: ReplicaSetData[];
  jobsData: JobData[];
  cronJobsData: CronJobData[];
  eventsData: EventData[];
  isLoading: boolean;
  errorMsg: string | null;
  refresh: () => void;
}

export function useWorkloadOverview(): WorkloadSummary {
  const activeInstanceId = useLayoutStore((s) => s.activeInstanceId);
  const kuberneterSelectedCluster = useKuberneterStore(
    (s) => s.kuberneterInstanceCluster[activeInstanceId] || ''
  );
  const kuberneterSelectedNamespace = useKuberneterStore(
    (s) => s.kuberneterInstanceNamespace[activeInstanceId] || 'All Namespaces'
  );
  const activeConfigPath = useKuberneterStore(
    (s) => s.kuberneterInstanceConfigPath[activeInstanceId] || 'default'
  );
  const refreshInterval = useKuberneterStore(
    (s) => s.kuberneterInstanceRefreshInterval[activeInstanceId] || '60s'
  );

  const [podsData, setPodsData] = useState<PodData[]>([]);
  const [deploysData, setDeploysData] = useState<DeployData[]>([]);
  const [daemonSetsData, setDaemonSetsData] = useState<DaemonSetData[]>([]);
  const [statefulSetsData, setStatefulSetsData] = useState<StatefulSetData[]>([]);
  const [replicaSetsData, setReplicaSetsData] = useState<ReplicaSetData[]>([]);
  const [jobsData, setJobsData] = useState<JobData[]>([]);
  const [cronJobsData, setCronJobsData] = useState<CronJobData[]>([]);
  const [eventsData, setEventsData] = useState<EventData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchAll = useCallback(
    async (isBackground = false) => {
      if (!kuberneterSelectedCluster) return;
      if (!isBackground) {
        setIsLoading(true);
        setErrorMsg(null);
      }
      try {
        const configPathArg = activeConfigPath === 'default' ? undefined : activeConfigPath;
        const nsArg =
          kuberneterSelectedNamespace === 'All Namespaces'
            ? undefined
            : kuberneterSelectedNamespace;

        const resources = [
          'pods',
          'deployments',
          'daemonsets',
          'statefulsets',
          'replicasets',
          'jobs',
          'cronjobs',
          'events'
        ];

        const results = await Promise.all(
          resources.map((r) =>
            window.kuberneter
              .getResources(configPathArg, kuberneterSelectedCluster, r, nsArg)
              .then((res) => ({ items: (res.items as K8sResource[]) || [] }))
              .catch(() => ({ items: [] as K8sResource[] }))
          )
        );

        const [pods, deploys, daemons, stateful, replicas, jobs, cronjobs, events] = results;

        setPodsData(parsePods(pods.items || []));
        setDeploysData(parseDeploys(deploys.items || []));
        setDaemonSetsData(parseDaemonSets(daemons.items || []));
        setStatefulSetsData(parseStatefulSets(stateful.items || []));
        setReplicaSetsData(parseReplicaSets(replicas.items || []));
        setJobsData(parseJobs(jobs.items || []));
        setCronJobsData(parseCronJobs(cronjobs.items || []));

        // Sort events by lastSeen descending
        const parsedEvents = parseEvents(events.items || []).sort(
          (a, b) => b.rawLastSeen - a.rawLastSeen
        );
        setEventsData(parsedEvents);
      } catch (err) {
        if (!isBackground) {
          setErrorMsg(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (!isBackground) setIsLoading(false);
      }
    },
    [kuberneterSelectedCluster, kuberneterSelectedNamespace, activeConfigPath]
  );

  // Parse refresh interval string like "30s", "5m", "1h"
  const getIntervalMs = (interval: string): number => {
    const match = interval.match(/^(\d+)(s|m|h)$/);
    if (!match) return 60_000;
    const [, num, unit] = match;
    const n = parseInt(num, 10);
    if (unit === 's') return n * 1000;
    if (unit === 'm') return n * 60_000;
    if (unit === 'h') return n * 3_600_000;
    return 60_000;
  };

  useEffect(() => {
    fetchAll(false);
    const ms = getIntervalMs(refreshInterval);
    const id = setInterval(() => fetchAll(true), ms);
    return () => clearInterval(id);
  }, [fetchAll, refreshInterval]);

  return {
    podsData,
    deploysData,
    daemonSetsData,
    statefulSetsData,
    replicaSetsData,
    jobsData,
    cronJobsData,
    eventsData,
    isLoading,
    errorMsg,
    refresh: () => fetchAll(false)
  };
}
