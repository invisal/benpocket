import { useState, useEffect } from 'react';
import { useLayoutStore } from '../../../../src/store/layout.store';
import { useKuberneterStore } from '../../store/kuberneter.store';
import { type PodData } from '../../types/PodData';
import { type DeployData } from '../../types/DeployData';
import { type ServiceData } from '../../types/ServiceData';
import { type ConfigMapData } from '../../types/ConfigMapData';
import { type ApplicationData } from '../../types/ApplicationData';
import { type NodeData } from '../../types/NodeData';
import { type DaemonSetData } from '../../types/DaemonSetData';
import { type StatefulSetData } from '../../types/StatefulSetData';
import { type ReplicaSetData } from '../../types/ReplicaSetData';
import { type JobData } from '../../types/JobData';
import { type CronJobData } from '../../types/CronJobData';
import { type K8sResource } from '../../types/K8sResource';
import { type TopNodeItem } from '../../types/TopNodeItem';
import { formatAge } from '../../utils/formatAge';
import { formatAgeLong } from '../../utils/formatAgeLong';
import { parseK8sCapacity, formatCapacity } from '../../utils/formatCapacity';
import { type PodResource, type ContainerStatus } from '../../types/PodResource';

export function useWorkspaceResources(resource: string) {
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
  const [servicesData, setServicesData] = useState<ServiceData[]>([]);
  const [configMapsData, setConfigMapsData] = useState<ConfigMapData[]>([]);
  const [applicationsData, setApplicationsData] = useState<ApplicationData[]>([]);
  const [nodesData, setNodesData] = useState<NodeData[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchResources = async (isBackground = false) => {
    if (resource === 'home' || resource === 'workloads-overview' || !kuberneterSelectedCluster)
      return;

    if (!isBackground) {
      setIsLoading(true);
      setErrorMsg(null);
    }
    try {
      const configPathArg = activeConfigPath === 'default' ? undefined : activeConfigPath;

      let queryResource = '';
      if (resource === 'pods') queryResource = 'pods';
      else if (resource === 'deployments') queryResource = 'deployments';
      else if (resource === 'daemonsets') queryResource = 'daemonsets';
      else if (resource === 'statefulsets') queryResource = 'statefulsets';
      else if (resource === 'replicasets') queryResource = 'replicasets';
      else if (resource === 'jobs') queryResource = 'jobs';
      else if (resource === 'cronjobs') queryResource = 'cronjobs';
      else if (resource === 'services') queryResource = 'services';
      else if (resource === 'configmaps') queryResource = 'configmaps';
      else if (resource === 'apps') queryResource = 'deployments,statefulsets,daemonsets';
      else if (resource === 'nodes') queryResource = 'nodes';
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

      let topNodesItems: TopNodeItem[] = [];
      if (resource === 'nodes') {
        try {
          const topNodesRes = await window.kuberneter.getTopNodes(
            configPathArg,
            kuberneterSelectedCluster
          );
          if (topNodesRes && topNodesRes.items) {
            topNodesItems = topNodesRes.items;
          }
        } catch (e) {
          console.warn('Failed to fetch top nodes', e);
        }
      }

      let topPodsItems: { namespace: string; name: string; cpu: string; memory: string }[] = [];
      if (resource === 'pods') {
        try {
          const topPodsRes = await window.kuberneter.getTopPods(
            configPathArg,
            kuberneterSelectedCluster,
            kuberneterSelectedNamespace
          );
          if (topPodsRes && topPodsRes.items) {
            topPodsItems = topPodsRes.items;
          }
        } catch (e) {
          console.warn('Failed to fetch top pods', e);
        }
      }

      const items = (res.items as K8sResource[]) || [];

      if (resource === 'pods') {
        const transformed = items.map((item) => {
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
        setPodsData(transformed);
      } else if (resource === 'deployments') {
        const transformed = items.map((item) => {
          const deployItem = item;
          const name = deployItem.metadata?.name || '';
          const ns = deployItem.metadata?.namespace || '';
          const replicas = deployItem.spec?.replicas ?? 0;
          const readyReplicas = deployItem.status?.readyReplicas ?? 0;
          const upToDate = deployItem.status?.updatedReplicas ?? 0;
          const available = deployItem.status?.availableReplicas ?? 0;

          let status = 'Pending';
          if (replicas > 0 && readyReplicas === replicas) {
            status = 'Running';
          }

          const hasWarning = replicas > 0 && available < replicas;
          const strategy = deployItem.spec?.strategy?.type || 'RollingUpdate';

          return {
            id: `${ns}/${name}`,
            name,
            ns,
            ready: `${readyReplicas}/${replicas}`,
            upToDate,
            available,
            age: formatAge(deployItem.metadata?.creationTimestamp || ''),
            rawAge: new Date(deployItem.metadata?.creationTimestamp || Date.now())
              .getTime()
              .toString(),
            replicas,
            status,
            hasWarning,
            strategy
          };
        });
        setDeploysData(transformed);
      } else if (resource === 'daemonsets') {
        const transformed = items.map((item) => {
          const dsItem = item;
          const name = dsItem.metadata?.name || '';
          const ns = dsItem.metadata?.namespace || '';
          const desired = dsItem.status?.desiredNumberScheduled ?? 0;
          const current = dsItem.status?.currentNumberScheduled ?? 0;
          const ready = dsItem.status?.numberReady ?? 0;
          const upToDate = dsItem.status?.updatedNumberScheduled ?? 0;
          const available = dsItem.status?.numberAvailable ?? 0;

          const nodeSelectorObj = dsItem.spec?.template?.spec?.nodeSelector || {};
          const nodeSelector =
            Object.entries(nodeSelectorObj)
              .map(([k, v]) => `${k}=${v}`)
              .join(', ') || '';

          const hasWarning = desired > 0 && available < desired;

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
            age: formatAge(dsItem.metadata?.creationTimestamp || ''),
            rawAge: new Date(dsItem.metadata?.creationTimestamp || Date.now()).getTime().toString(),
            hasWarning
          };
        });
        setDaemonSetsData(transformed);
      } else if (resource === 'statefulsets') {
        const transformed = items.map((item) => {
          const name = item.metadata?.name || '';
          const ns = item.metadata?.namespace || '';
          const replicas = item.spec?.replicas ?? 0;
          const readyReplicas = item.status?.readyReplicas ?? 0;
          const hasWarning = replicas > 0 && readyReplicas < replicas;

          return {
            id: `${ns}/${name}`,
            name,
            ns,
            ready: `${readyReplicas}/${replicas}`,
            replicas,
            age: formatAge(item.metadata?.creationTimestamp || ''),
            rawAge: new Date(item.metadata?.creationTimestamp || Date.now()).getTime().toString(),
            hasWarning
          };
        });
        setStatefulSetsData(transformed);
      } else if (resource === 'replicasets') {
        const transformed = items.map((item) => {
          const name = item.metadata?.name || '';
          const ns = item.metadata?.namespace || '';
          const desired = item.spec?.replicas ?? 0;
          const current = item.status?.replicas ?? 0;
          const ready = item.status?.readyReplicas ?? 0;
          const hasWarning = desired > 0 && ready < desired;

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
        setReplicaSetsData(transformed);
      } else if (resource === 'jobs') {
        const transformed = items.map((item) => {
          const name = item.metadata?.name || '';
          const ns = item.metadata?.namespace || '';
          const desired = item.spec?.completions ?? 1;
          const succeeded = item.status?.succeeded ?? 0;
          const failed = item.status?.failed ?? 0;

          // Derive conditions string from status.conditions
          const conditions = item.status?.conditions || [];
          const condStr =
            conditions
              .filter((c) => c.status === 'True')
              .map((c) => c.type)
              .join(', ') || (succeeded > 0 ? 'Complete' : failed > 0 ? 'Failed' : 'Running');

          const hasWarning = failed > 0;

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
            hasWarning
          };
        });
        setJobsData(transformed);
      } else if (resource === 'cronjobs') {
        const transformed = items.map((item) => {
          const name = item.metadata?.name || '';
          const ns = item.metadata?.namespace || '';
          const schedule = item.spec?.schedule || '-';
          const suspend = item.spec?.suspend ?? false;
          const active = item.status?.active ?? 0;
          const timeZone = item.spec?.timeZone || '-';

          // Last schedule: age since lastScheduleTime
          const lastScheduleTime = item.status?.lastScheduleTime;
          const lastSchedule = lastScheduleTime ? formatAge(lastScheduleTime) : '-';

          // Next execution: only computable if not suspended and we have the schedule
          // We display N/A when suspended, otherwise leave as '-' (server-side calculation)
          const nextExecution = suspend ? 'N/A' : '-';

          // Warning: suspended with active jobs, or no schedule
          const hasWarning = active > 0 && suspend;

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
            hasWarning
          };
        });
        setCronJobsData(transformed);
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
      } else if (resource === 'nodes') {
        const transformed = items.map((item) => {
          const name = item.metadata?.name || '';

          // Conditions
          const conditions = item.status?.conditions || [];
          const readyCondition = conditions.find((c) => c.type === 'Ready');
          const conditionsStr =
            readyCondition?.status === 'True' ? 'Ready' : readyCondition?.message || 'NotReady';

          // Warnings
          const badConditions = [
            'MemoryPressure',
            'DiskPressure',
            'PIDPressure',
            'NetworkUnavailable'
          ];
          const hasWarning =
            readyCondition?.status !== 'True' ||
            conditions.some((c) => c.type && badConditions.includes(c.type) && c.status === 'True');

          // Labels & Roles
          const labels = item.metadata?.labels || {};
          const roles = Object.keys(labels)
            .filter((key) => key.startsWith('node-role.kubernetes.io/'))
            .map((key) => key.replace('node-role.kubernetes.io/', ''))
            .join(', ');

          // Age & Version
          const age = formatAge(item.metadata?.creationTimestamp || '');
          const version = item.status?.nodeInfo?.kubeletVersion || '';
          const taints = item.spec?.taints?.length || 0;

          // Real metrics if available
          const topNode = topNodesItems.find((tn) => tn.name === name);

          const cpuCapRaw = item.status?.capacity?.cpu || '0';
          const memCapRaw = item.status?.capacity?.memory || '0';
          const diskCapRaw = item.status?.capacity?.['ephemeral-storage'] || '0';

          const cpuCapCores = parseK8sCapacity(cpuCapRaw);
          const cpuCapacity = `${parseFloat(cpuCapCores.toFixed(2))}`;
          const memoryCapacity = formatCapacity(parseK8sCapacity(memCapRaw));
          const diskCapacity = formatCapacity(parseK8sCapacity(diskCapRaw));

          // Generate deterministic mock usage percentages based on node name
          let hash = 0;
          for (let i = 0; i < name.length; i++) {
            hash = name.charCodeAt(i) + ((hash << 5) - hash);
          }
          const cpuPercent = topNode ? parseInt(topNode.cpuPct || '0') : Math.abs(hash % 40) + 10;
          const memoryPercent = topNode
            ? parseInt(topNode.memoryPct || '0')
            : Math.abs((hash >> 2) % 50) + 20;
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
            rawConditions: conditions.map((c) => c.type).join(' ')
          };
        });
        setNodesData(transformed);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!isBackground) {
        setErrorMsg(msg || 'Failed to fetch cluster resources.');
      } else {
        console.warn('Background fetch failed:', msg);
      }
    } finally {
      if (!isBackground) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    queueMicrotask(() => fetchResources(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resource, kuberneterSelectedCluster, kuberneterSelectedNamespace, activeConfigPath]);

  useEffect(() => {
    if (refreshInterval === 'off' || !kuberneterSelectedCluster) return;

    const intervalMap: Record<string, number> = {
      '5s': 5000,
      '10s': 10000,
      '30s': 30000,
      '60s': 60000
    };

    const ms = intervalMap[refreshInterval] || 60000;
    const timer = setInterval(() => {
      fetchResources(true);
    }, ms);

    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    resource,
    kuberneterSelectedCluster,
    kuberneterSelectedNamespace,
    activeConfigPath,
    refreshInterval
  ]);

  return {
    kuberneterSelectedCluster,
    kuberneterSelectedNamespace,
    podsData,
    deploysData,
    daemonSetsData,
    statefulSetsData,
    replicaSetsData,
    jobsData,
    cronJobsData,
    servicesData,
    configMapsData,
    applicationsData,
    nodesData,
    isLoading,
    errorMsg
  };
}
