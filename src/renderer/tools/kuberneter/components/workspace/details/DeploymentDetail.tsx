import { Age } from '../../Age';
import type React from 'react';
import { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import {
  type DeployData,
  type DeployRevision,
  type DeployRelatedPod
} from '../../../types/DeployData';
import { KubeTable } from '../../kubeTable';
import { KubePropertiesTable, type PropertyItem } from './KubePropertiesTable';
import { MetricsSection } from './metrics';
import {
  useInstantMetrics,
  formatInstantCpu,
  formatInstantMemory
} from '../../../hooks/useMetrics';
import {
  useOpenNamespaceDetail,
  useOpenPodDetail,
  useOpenNodeDetail,
  useOpenWorkloadDetail
} from '../../../hooks/open-detail';
import { useLayoutStore } from '../../../../../src/store/layout.store';
import { useKuberneterStore } from '../../../store/kuberneter.store';
import { K8S_RESOURCE_KEYS } from '../../../constants/k8sResources';
import { type K8sResource } from '../../../types/K8sResource';
import { formatAge } from '../../../utils/formatAge';

interface DeploymentDetailProps {
  payload: DeployData;
  isTab?: boolean;
}

interface DeployRawResource {
  metadata?: {
    name?: string;
    namespace?: string;
    creationTimestamp?: string;
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
  };
  spec?: {
    replicas?: number;
    selector?: {
      matchLabels?: Record<string, string>;
    };
    strategy?: {
      type?: string;
    };
  };
  status?: {
    replicas?: number;
    updatedReplicas?: number;
    readyReplicas?: number;
    availableReplicas?: number;
    unavailableReplicas?: number;
    conditions?: Array<{
      type: string;
      status: string;
      reason?: string;
      message?: string;
    }>;
  };
}

export const DeploymentDetail: React.FC<DeploymentDetailProps> = ({ payload, isTab = false }) => {
  const activeInstanceId = useLayoutStore((s) => s.activeInstanceId);
  const cluster = useKuberneterStore((s) => s.kuberneterInstanceCluster[activeInstanceId] || '');
  const rawConfigPath = useKuberneterStore(
    (s) => s.kuberneterInstanceConfigPath[activeInstanceId] || 'default'
  );

  const { openNamespaceDetail } = useOpenNamespaceDetail();
  const { openPodDetail } = useOpenPodDetail();
  const { openNodeDetail } = useOpenNodeDetail();
  const { openReplicaSetDetail } = useOpenWorkloadDetail();

  const [selectedTarget, setSelectedTarget] = useState<string>('all');

  const metricsQuery = useInstantMetrics(true);
  const metricItems = metricsQuery.data ?? [];

  // Fetch full deployment, replica sets, and pods with React Query caching
  const { data: queryData } = useQuery({
    queryKey: [
      'kuberneter',
      'deployment-detail-data',
      rawConfigPath,
      cluster,
      payload?.ns,
      payload?.name
    ],
    queryFn: async () => {
      if (!cluster || !payload?.ns || !payload?.name) return null;
      const configPathArg = rawConfigPath === 'default' ? undefined : rawConfigPath;
      const [deployRes, rsRes, podsRes] = await Promise.all([
        window.kuberneter.getResources(
          configPathArg,
          cluster,
          K8S_RESOURCE_KEYS.DEPLOYMENTS,
          payload.ns
        ),
        window.kuberneter.getResources(
          configPathArg,
          cluster,
          K8S_RESOURCE_KEYS.REPLICA_SETS,
          payload.ns
        ),
        window.kuberneter.getResources(configPathArg, cluster, K8S_RESOURCE_KEYS.PODS, payload.ns)
      ]);
      const deployItem = ((deployRes?.items || []) as K8sResource[]).find(
        (i) => i.metadata?.name === payload.name
      );
      const allRS = (rsRes?.items || []) as K8sResource[];
      const allPods = (podsRes?.items || []) as K8sResource[];

      // Match ReplicaSets owned by this Deployment
      const matchedRSList = allRS.filter((rs) => {
        const ownerRefs = rs.metadata?.ownerReferences || [];
        return (
          rs.metadata?.namespace === payload.ns &&
          ownerRefs.some((ref) => ref.kind === 'Deployment' && ref.name === payload.name)
        );
      });

      const revisions: DeployRevision[] = matchedRSList
        .map((rs) => {
          const revStr = rs.metadata?.annotations?.['deployment.kubernetes.io/revision'] || '1';
          const revision = parseInt(revStr, 10) || 1;
          const rsReplicas = (rs.spec?.replicas as number) ?? 0;
          const rsReady = (rs.status?.readyReplicas as number) ?? 0;
          return {
            revision,
            name: rs.metadata?.name || '',
            podsCount: `${rsReady}/${rsReplicas}`,
            age: formatAge(rs.metadata?.creationTimestamp || ''),
            creationTimestamp: rs.metadata?.creationTimestamp || '',
            rawItem: rs
          } as DeployRevision & { rawItem?: K8sResource };
        })
        .sort((a, b) => b.revision - a.revision);

      const matchedRSNames = new Set(matchedRSList.map((rs) => rs.metadata?.name).filter(Boolean));
      const matchedPods = allPods.filter((pod) => {
        const ownerRefs = pod.metadata?.ownerReferences || [];
        return (
          pod.metadata?.namespace === payload.ns &&
          ownerRefs.some((ref) => ref.kind === 'ReplicaSet' && matchedRSNames.has(ref.name))
        );
      });

      const podsList: DeployRelatedPod[] = matchedPods.map((pod) => {
        const podName = pod.metadata?.name || '';
        const node = (pod.spec?.nodeName as string) || '—';
        const containerStatuses =
          (pod.status?.containerStatuses as Array<{ ready?: boolean }>) || [];
        const readyCount = containerStatuses.filter((c) => c.ready).length;
        const totalCount = containerStatuses.length;
        const phase = (pod.status?.phase as string) || 'Unknown';
        return {
          name: podName,
          node,
          ns: payload.ns,
          ready: `${readyCount}/${totalCount}`,
          cpu: 'N/A',
          memory: 'N/A',
          status: phase,
          hasWarning: phase !== 'Running' && phase !== 'Succeeded',
          rawItem: pod
        } as DeployRelatedPod & { rawItem?: K8sResource };
      });

      return {
        deployItem,
        revisions,
        podsList
      };
    },
    enabled: !!cluster && !!payload?.ns && !!payload?.name,
    placeholderData: keepPreviousData,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000
  });

  if (!payload) {
    return <div className="p-4 text-xs text-zinc-500">No deployment details available.</div>;
  }

  const pods = queryData?.podsList || payload?.podsList || [];
  const revisions = queryData?.revisions || payload?.revisions || [];
  const rawItem = (queryData?.deployItem || payload.rawItem) as unknown as
    DeployRawResource | undefined;

  const allPodNames = pods.map((p) => p.name);
  const targetPodNames =
    selectedTarget === 'all'
      ? allPodNames
      : pods.some((p) => p.name === selectedTarget)
        ? [selectedTarget]
        : allPodNames;

  const handleNamespaceClick = () => {
    if (payload.ns) {
      openNamespaceDetail(payload.ns);
    }
  };

  const labels = rawItem?.metadata?.labels ? Object.entries(rawItem.metadata.labels) : [];
  const annotations = rawItem?.metadata?.annotations
    ? Object.entries(rawItem.metadata.annotations)
    : [];

  // Created time formatted
  const createdTime = rawItem?.metadata?.creationTimestamp
    ? new Date(rawItem.metadata.creationTimestamp).toLocaleString()
    : '';

  // Replicas breakdown
  const desired = rawItem?.spec?.replicas ?? payload.replicas ?? 0;
  const updated = rawItem?.status?.updatedReplicas ?? payload.upToDate ?? 0;
  const total = rawItem?.status?.replicas ?? payload.replicas ?? 0;
  const available = rawItem?.status?.availableReplicas ?? payload.available ?? 0;
  const unavailable = rawItem?.status?.unavailableReplicas ?? 0;

  // Selector
  const selectorLabels = rawItem?.spec?.selector?.matchLabels
    ? Object.entries(rawItem.spec.selector.matchLabels)
    : [];
  const selectorStr = selectorLabels.map(([k, v]) => `${k}=${v}`).join(', ');

  // Conditions
  const conditions = rawItem?.status?.conditions || [];

  const propertiesData: PropertyItem[] = [
    {
      id: 'created',
      name: 'Created',
      value: (
        <span>
          <Age
            timestamp={(payload as unknown as Record<string, unknown>).creationTimestamp as string}
          />{' '}
          ago ({createdTime || 'N/A'})
        </span>
      )
    },
    {
      id: 'name',
      name: 'Name',
      value: payload.name
    },
    {
      id: 'namespace',
      name: 'Namespace',
      value: (
        <span
          onClick={handleNamespaceClick}
          className="font-mono text-accent hover:underline cursor-pointer self-start"
        >
          {payload.ns}
        </span>
      )
    },
    {
      id: 'labels',
      name: 'Labels',
      value: `${labels.length} Labels`,
      hasDetail: labels.length > 0,
      renderDetail: () => (
        <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto pr-1 select-text">
          {labels.map(([k, v]) => (
            <span
              key={k}
              className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-surface-3 border border-border/60 text-zinc-300 break-all"
            >
              {k}: {v}
            </span>
          ))}
        </div>
      )
    },
    {
      id: 'annotations',
      name: 'Annotations',
      value: `${annotations.length} Annotations`,
      hasDetail: annotations.length > 0,
      renderDetail: () => (
        <div className="flex flex-col gap-1 max-h-32 overflow-y-auto pr-1 select-text">
          {annotations.map(([k, v]) => (
            <div
              key={k}
              className="font-mono text-[10px] text-zinc-400 bg-editor-bg px-2 py-1 rounded border border-border-dark/60 truncate"
              title={`${k}=${v}`}
            >
              {k}={v}
            </div>
          ))}
        </div>
      )
    },
    {
      id: 'replicas',
      name: 'Replicas',
      value: `${desired} desired, ${updated} updated, ${total} total, ${available} available, ${unavailable} unavailable`
    },
    {
      id: 'selector',
      name: 'Selector',
      value:
        selectorLabels.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {selectorLabels.map(([k, v]) => (
              <span
                key={k}
                className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-zinc-800 border border-border/80 text-zinc-300"
              >
                {k}={v}
              </span>
            ))}
          </div>
        ) : (
          selectorStr || '—'
        )
    },
    {
      id: 'strategy',
      name: 'Strategy Type',
      value: payload.strategy
    },
    {
      id: 'status',
      name: 'Status',
      value: (
        <span
          className={`font-semibold ${
            payload.hasWarning ? 'text-amber-500 animate-pulse' : 'text-emerald-500'
          }`}
        >
          {payload.status}
        </span>
      )
    }
  ];

  if (conditions.length > 0) {
    propertiesData.push({
      id: 'conditions',
      name: 'Conditions',
      value: (
        <div className="flex flex-wrap gap-1.5">
          {conditions.map((c) => {
            const isTrue = c.status === 'True';
            const isAvailable = c.type === 'Available';
            const badgeColor =
              isAvailable && isTrue
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-450'
                : isTrue
                  ? 'bg-blue-500/10 border-blue-500/20 text-blue-400'
                  : 'bg-zinc-800 border-border/85 text-zinc-400';
            return (
              <span
                key={c.type}
                className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono border ${badgeColor}`}
                title={c.message}
              >
                {c.type}
              </span>
            );
          })}
        </div>
      )
    });
  }

  return (
    <div className={`flex flex-col gap-4 ${isTab ? 'p-6 h-full overflow-y-auto' : 'flex-1'}`}>
      {/* Metrics Section */}
      <div className="flex flex-col gap-2">
        {pods.length > 0 && (
          <div className="flex items-center justify-between px-1">
            <span className="text-[10px] font-bold text-zinc-450 uppercase tracking-wider">
              Metrics
            </span>
            <select
              value={selectedTarget}
              onChange={(e) => setSelectedTarget(e.target.value)}
              className="w-24 bg-surface-3 border border-border/60 rounded text-[10px] font-mono px-2 py-0.5 text-foreground outline-none cursor-pointer truncate"
            >
              <option value="all">All ({pods.length})</option>
              {pods.map((p) => (
                <option key={p.name} value={p.name}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <MetricsSection
          namespace={payload.ns}
          podNames={targetPodNames}
          resourceLabel="deployment"
        />
      </div>

      {/* Properties Section */}
      <div className="flex flex-col gap-2.5">
        <span className="text-[10px] font-bold text-zinc-450 uppercase tracking-wider mb-1">
          Properties
        </span>
        <KubePropertiesTable properties={propertiesData} />
      </div>

      {/* Deploy Revisions */}
      <div className="flex flex-col gap-2 mt-1 border-t border-border-dark/60 pt-3">
        <span className="text-[10px] font-bold text-zinc-455 uppercase tracking-wider">
          Deploy Revisions
        </span>
        {revisions.length === 0 ? (
          <div className="text-xs text-zinc-500 italic pl-1">No revisions found</div>
        ) : (
          <div className="border-y border-border/40 flex flex-col max-h-[160px] h-auto w-full overflow-y-auto">
            <KubeTable<DeployRevision>
              columns={[
                {
                  key: 'revision',
                  header: '#',
                  className: 'py-2 px-3 text-zinc-200',
                  render: (row) => {
                    const index = revisions.findIndex((r) => r.name === row.name);
                    return (
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`w-1 h-3 rounded-sm ${index === 0 ? 'bg-emerald-500' : 'bg-zinc-650/60'}`}
                        ></span>
                        <span>{row.revision}</span>
                      </div>
                    );
                  }
                },
                {
                  key: 'name',
                  header: 'Summary',
                  className: 'py-2 px-3 text-zinc-400 truncate max-w-[200px]',
                  render: (row) => (
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        openReplicaSetDetail(
                          payload.ns,
                          row.name,
                          (row as unknown as { rawItem?: K8sResource }).rawItem
                        );
                      }}
                      className="text-accent hover:underline cursor-pointer font-mono"
                      title={row.name}
                    >
                      {row.name}
                    </span>
                  )
                },
                {
                  key: 'podsCount',
                  header: 'Pods',
                  className: 'py-2 px-3 text-zinc-300'
                },
                {
                  key: 'age',
                  header: 'Age',
                  className: 'py-2 px-3 text-zinc-450',
                  render: (row) => (
                    <Age
                      timestamp={
                        (row as unknown as Record<string, unknown>).creationTimestamp as string
                      }
                    />
                  )
                },
                {
                  key: 'actions',
                  header: '',
                  className:
                    'py-2 px-3 text-center text-zinc-500 hover:text-zinc-300 cursor-pointer select-none',
                  render: () => '⋮'
                }
              ]}
              data={revisions}
              getRowKey={(row) => row.name}
              onRowClick={(row) =>
                openReplicaSetDetail(
                  payload.ns,
                  row.name,
                  (row as unknown as { rawItem?: K8sResource }).rawItem
                )
              }
              resizable={false}
            />
          </div>
        )}
      </div>

      {/* Pods Section */}
      <div className="flex flex-col gap-2 mt-2 border-t border-border-dark/60 pt-3">
        <span className="text-[10px] font-bold text-zinc-455 uppercase tracking-wider">Pods</span>
        {pods.length === 0 ? (
          <div className="text-xs text-zinc-500 italic pl-1">No pods found</div>
        ) : (
          <div className="border-y border-border/40 flex flex-col max-h-[160px] h-auto w-full overflow-y-auto">
            <KubeTable<DeployRelatedPod>
              columns={[
                {
                  key: 'name',
                  header: 'Name',
                  className: 'py-2 px-3 text-zinc-200 font-semibold truncate max-w-[180px]',
                  render: (row) => (
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        openPodDetail(
                          row.ns,
                          row.name,
                          (row as unknown as { rawItem?: K8sResource }).rawItem
                        );
                      }}
                      className="text-accent hover:underline cursor-pointer font-sans"
                      title={row.name}
                    >
                      {row.name}
                    </span>
                  )
                },
                {
                  key: 'node',
                  header: 'Node',
                  className: 'py-2 px-3 text-zinc-300 truncate max-w-[100px]',
                  render: (row) => (
                    <span
                      onClick={(e) => {
                        if (row.node && row.node !== '—') {
                          e.stopPropagation();
                          openNodeDetail(row.node);
                        }
                      }}
                      className={
                        row.node && row.node !== '—'
                          ? 'text-accent hover:underline cursor-pointer font-mono'
                          : 'text-zinc-400'
                      }
                      title={row.node}
                    >
                      {row.node}
                    </span>
                  )
                },
                {
                  key: 'ns',
                  header: 'Namespace',
                  className: 'py-2 px-3 text-accent hover:underline cursor-pointer',
                  render: (row) => <span onClick={handleNamespaceClick}>{row.ns}</span>
                },
                {
                  key: 'ready',
                  header: 'Ready',
                  className: 'py-2 px-3 text-zinc-300'
                },
                {
                  key: 'cpu',
                  header: 'CPU',
                  className: 'py-2 px-3 font-mono text-zinc-300 text-xs',
                  render: (row) => {
                    const podMetric = metricItems.find(
                      (p) => p.name === row.name && (!p.namespace || p.namespace === row.ns)
                    );
                    const cpuStr = podMetric?.cpu
                      ? formatInstantCpu(podMetric.cpu)
                      : row.cpu && row.cpu !== 'N/A'
                        ? row.cpu
                        : 'N/A';
                    return <span>{cpuStr}</span>;
                  }
                },
                {
                  key: 'memory',
                  header: 'Memory',
                  className: 'py-2 px-3 font-mono text-zinc-300 text-xs',
                  render: (row) => {
                    const podMetric = metricItems.find(
                      (p) => p.name === row.name && (!p.namespace || p.namespace === row.ns)
                    );
                    const memStr = podMetric?.memory
                      ? formatInstantMemory(podMetric.memory)
                      : row.memory && row.memory !== 'N/A'
                        ? row.memory
                        : 'N/A';
                    return <span>{memStr}</span>;
                  }
                },
                {
                  key: 'status',
                  header: 'Status',
                  className: 'py-2 px-3',
                  render: (row) => (
                    <span className={row.hasWarning ? 'text-rose-500' : 'text-emerald-500'}>
                      {row.status}
                    </span>
                  )
                },
                {
                  key: 'actions',
                  header: '',
                  className:
                    'py-2 px-3 text-center text-zinc-500 hover:text-zinc-300 cursor-pointer select-none',
                  render: () => '⋮'
                }
              ]}
              data={pods}
              getRowKey={(row) => row.name}
              onRowClick={(row) =>
                openPodDetail(
                  row.ns,
                  row.name,
                  (row as unknown as { rawItem?: K8sResource }).rawItem
                )
              }
              resizable={false}
            />
          </div>
        )}
      </div>

      {/* Events Section */}
      <div className="flex flex-col gap-1.5 mt-2 border-t border-border-dark/60 pt-3">
        <span className="text-[10px] font-bold text-zinc-450 uppercase tracking-wider">Events</span>
        <div className="text-xs text-zinc-500 italic pl-1 mt-0.5">No events found</div>
      </div>
    </div>
  );
};
