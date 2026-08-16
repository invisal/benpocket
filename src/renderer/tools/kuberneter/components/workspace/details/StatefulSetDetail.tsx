import { Age } from '../../Age';
import type React from 'react';
import { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { type StatefulSetData } from '../../../types/StatefulSetData';
import { type DeployRelatedPod } from '../../../types/DeployData';
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
  useOpenNodeDetail
} from '../../../hooks/open-detail';
import { useLayoutStore } from '../../../../../src/store/layout.store';
import { useKuberneterStore } from '../../../store/kuberneter.store';
import { K8S_RESOURCE_KEYS } from '../../../constants/k8sResources';
import { type K8sResource } from '../../../types/K8sResource';

interface StatefulSetDetailProps {
  payload: StatefulSetData;
  isTab?: boolean;
}

interface StatefulSetRawResource {
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
    serviceName?: string;
    volumeClaimTemplates?: Array<{
      metadata?: { name?: string };
      spec?: {
        accessModes?: string[];
        resources?: { requests?: { storage?: string } };
        storageClassName?: string;
      };
    }>;
  };
  status?: {
    replicas?: number;
    readyReplicas?: number;
    currentReplicas?: number;
    updatedReplicas?: number;
    availableReplicas?: number;
    conditions?: Array<{
      type: string;
      status: string;
      reason?: string;
      message?: string;
    }>;
  };
}

export const StatefulSetDetail: React.FC<StatefulSetDetailProps> = ({ payload, isTab = false }) => {
  const activeInstanceId = useLayoutStore((s) => s.activeInstanceId);
  const cluster = useKuberneterStore((s) => s.kuberneterInstanceCluster[activeInstanceId] || '');
  const rawConfigPath = useKuberneterStore(
    (s) => s.kuberneterInstanceConfigPath[activeInstanceId] || 'default'
  );

  const { openNamespaceDetail } = useOpenNamespaceDetail();
  const { openPodDetail } = useOpenPodDetail();
  const { openNodeDetail } = useOpenNodeDetail();

  const [selectedTarget, setSelectedTarget] = useState<string>('all');

  const metricsQuery = useInstantMetrics(true);
  const metricItems = metricsQuery.data ?? [];

  // Fetch full StatefulSet and its Pods with React Query caching
  const { data: queryData } = useQuery({
    queryKey: [
      'kuberneter',
      'statefulset-detail-data',
      rawConfigPath,
      cluster,
      payload?.ns,
      payload?.name
    ],
    queryFn: async () => {
      if (!cluster || !payload?.ns || !payload?.name) return null;
      const configPathArg = rawConfigPath === 'default' ? undefined : rawConfigPath;
      const [stsRes, podsRes] = await Promise.all([
        window.kuberneter.getResources(
          configPathArg,
          cluster,
          K8S_RESOURCE_KEYS.STATEFUL_SETS,
          payload.ns
        ),
        window.kuberneter.getResources(configPathArg, cluster, K8S_RESOURCE_KEYS.PODS, payload.ns)
      ]);
      const stsItem = ((stsRes?.items || []) as K8sResource[]).find(
        (i) => i.metadata?.name === payload.name
      );
      const allPods = (podsRes?.items || []) as K8sResource[];

      // Match Pods belonging to this StatefulSet
      const matchedPods = allPods.filter((pod) => {
        const ownerRefs = pod.metadata?.ownerReferences || [];
        const isOwner = ownerRefs.some(
          (ref) => ref.kind === 'StatefulSet' && ref.name === payload.name
        );
        const nameMatches = pod.metadata?.name?.startsWith(`${payload.name}-`);
        return pod.metadata?.namespace === payload.ns && (isOwner || nameMatches);
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
        stsItem,
        podsList
      };
    },
    enabled: !!cluster && !!payload?.ns && !!payload?.name,
    placeholderData: keepPreviousData,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000
  });

  if (!payload) {
    return <div className="p-4 text-xs text-zinc-500">No stateful set details available.</div>;
  }

  const pods = queryData?.podsList || payload?.podsList || [];
  const rawItem = (queryData?.stsItem || payload.rawItem) as unknown as
    StatefulSetRawResource | undefined;

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

  const createdTime = rawItem?.metadata?.creationTimestamp
    ? new Date(rawItem.metadata.creationTimestamp).toLocaleString()
    : payload.createdTime || '';

  const replicas = rawItem?.spec?.replicas ?? payload.replicas ?? 0;
  const readyReplicas = rawItem?.status?.readyReplicas ?? 0;
  const readyStr = payload.ready || `${readyReplicas}/${replicas}`;

  const selectorLabels = rawItem?.spec?.selector?.matchLabels
    ? Object.entries(rawItem.spec.selector.matchLabels)
    : payload.selector
      ? Object.entries(payload.selector)
      : [];
  const selectorStr = selectorLabels.map(([k, v]) => `${k}=${v}`).join(', ');

  const serviceName = rawItem?.spec?.serviceName || '—';
  const volumeClaims = rawItem?.spec?.volumeClaimTemplates || [];

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
      id: 'serviceName',
      name: 'Service Name',
      value: <span className="font-mono text-zinc-300">{serviceName}</span>
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
      name: 'Pods / Replicas',
      value: `Ready: ${readyStr} (Desired Replicas: ${replicas})`
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
      id: 'status',
      name: 'Status',
      value: (
        <span
          className={`font-semibold ${
            readyReplicas < replicas ? 'text-amber-500 animate-pulse' : 'text-emerald-500'
          }`}
        >
          {readyReplicas >= replicas ? 'Running' : 'Degraded'}
        </span>
      )
    }
  ];

  if (volumeClaims.length > 0) {
    propertiesData.push({
      id: 'volumeClaims',
      name: 'Volume Claim Templates',
      value: `${volumeClaims.length} Claim Templates`,
      hasDetail: true,
      renderDetail: () => (
        <div className="flex flex-col gap-1.5 max-h-28 overflow-y-auto pr-1 select-text">
          {volumeClaims.map((vc) => (
            <div
              key={vc.metadata?.name}
              className="font-mono text-[10px] text-zinc-300 bg-surface-3 px-2 py-1 rounded border border-border/60 flex items-center justify-between"
            >
              <span>{vc.metadata?.name}</span>
              <span className="text-zinc-450">
                {vc.spec?.resources?.requests?.storage || '—'} (
                {vc.spec?.storageClassName || 'default'})
              </span>
            </div>
          ))}
        </div>
      )
    });
  }

  if (conditions.length > 0) {
    propertiesData.push({
      id: 'conditions',
      name: 'Conditions',
      value: (
        <div className="flex flex-wrap gap-1.5">
          {conditions.map((c) => {
            const isTrue = c.status === 'True';
            return (
              <span
                key={c.type}
                className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono border ${
                  isTrue
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-450'
                    : 'bg-zinc-800 border-border/85 text-zinc-400'
                }`}
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
          resourceLabel="statefulset"
        />
      </div>

      {/* Properties Section */}
      <div className="flex flex-col gap-2.5">
        <span className="text-[10px] font-bold text-zinc-450 uppercase tracking-wider mb-1">
          Properties
        </span>
        <KubePropertiesTable properties={propertiesData} />
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
