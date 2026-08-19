import { Age } from '../../Age';
import type React from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import {
  type HorizontalPodAutoscalerData,
  type HpaMetric
} from '../../../types/HorizontalPodAutoscalerData';
import { type DeployRelatedPod } from '../../../types/DeployData';
import { KubeTable } from '../../kubeTable';
import { KubePropertiesTable, type PropertyItem } from './KubePropertiesTable';
import {
  useOpenNamespaceDetail,
  useOpenPodDetail,
  useOpenNodeDetail,
  useOpenResourceDetail
} from '../../../hooks/open-detail';
import {
  useInstantMetrics,
  formatInstantCpu,
  formatInstantMemory
} from '../../../hooks/useMetrics';
import { useLayoutStore } from '../../../../../src/store/layout.store';
import { useKuberneterStore } from '../../../store/kuberneter.store';
import { K8S_RESOURCE_KEYS } from '../../../constants/k8sResources';
import { type K8sResource } from '../../../types/K8sResource';

interface HorizontalPodAutoscalerDetailProps {
  payload: HorizontalPodAutoscalerData;
  isTab?: boolean;
}

interface HpaRawResource {
  metadata?: {
    name?: string;
    namespace?: string;
    creationTimestamp?: string;
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
  };
  spec?: {
    scaleTargetRef?: {
      apiVersion?: string;
      kind?: string;
      name?: string;
    };
    minReplicas?: number;
    maxReplicas?: number;
    targetCPUUtilizationPercentage?: number;
    metrics?: Array<{
      type: string;
      resource?: {
        name: string;
        target?: {
          type: string;
          averageUtilization?: number;
          averageValue?: string;
        };
      };
    }>;
  };
  status?: {
    currentReplicas?: number;
    desiredReplicas?: number;
    currentCPUUtilizationPercentage?: number;
    currentMetrics?: Array<{
      type: string;
      resource?: {
        name: string;
        current?: {
          averageUtilization?: number;
          averageValue?: string;
        };
      };
    }>;
    conditions?: Array<{
      type: string;
      status: string;
      reason?: string;
      message?: string;
    }>;
  };
}

export const HorizontalPodAutoscalerDetail: React.FC<HorizontalPodAutoscalerDetailProps> = ({
  payload,
  isTab = false
}) => {
  const activeInstanceId = useLayoutStore((s) => s.activeInstanceId);
  const cluster = useKuberneterStore((s) => s.kuberneterInstanceCluster[activeInstanceId] || '');
  const rawConfigPath = useKuberneterStore(
    (s) => s.kuberneterInstanceConfigPath[activeInstanceId] || 'default'
  );

  const { openNamespaceDetail } = useOpenNamespaceDetail();
  const { openPodDetail } = useOpenPodDetail();
  const { openNodeDetail } = useOpenNodeDetail();
  const { openResourceDetail } = useOpenResourceDetail();

  const metricsQuery = useInstantMetrics(true);
  const metricItems = metricsQuery.data ?? [];

  // Fetch fresh HPA, target resource, and associated pods with React Query caching
  const { data: queryData } = useQuery({
    queryKey: [
      'kuberneter',
      'hpa-detail-data',
      rawConfigPath,
      cluster,
      payload?.ns,
      payload?.name,
      payload?.referenceKind,
      payload?.referenceName
    ],
    queryFn: async () => {
      if (!cluster || !payload?.ns || !payload?.name) return null;
      const configPathArg = rawConfigPath === 'default' ? undefined : rawConfigPath;

      const [hpaRes, podsRes] = await Promise.all([
        window.kuberneter.getResources(
          configPathArg,
          cluster,
          K8S_RESOURCE_KEYS.HORIZONTAL_POD_AUTOSCALERS,
          payload.ns
        ),
        window.kuberneter.getResources(configPathArg, cluster, K8S_RESOURCE_KEYS.PODS, payload.ns)
      ]);

      const hpaItem = ((hpaRes?.items || []) as K8sResource[]).find(
        (i) => i.metadata?.name === payload.name
      );
      const allPods = (podsRes?.items || []) as K8sResource[];

      const targetKind =
        (hpaItem?.spec as { scaleTargetRef?: { kind?: string } })?.scaleTargetRef?.kind ||
        payload.referenceKind;
      const targetName =
        (hpaItem?.spec as { scaleTargetRef?: { name?: string } })?.scaleTargetRef?.name ||
        payload.referenceName;

      let matchedPods: K8sResource[] = [];

      if (targetKind && targetName) {
        const lowerTarget = targetKind.toLowerCase();
        if (lowerTarget === 'deployment') {
          // Find RS owned by this Deployment, then pods owned by those RS
          try {
            const rsRes = await window.kuberneter.getResources(
              configPathArg,
              cluster,
              K8S_RESOURCE_KEYS.REPLICA_SETS,
              payload.ns
            );
            const allRS = (rsRes?.items || []) as K8sResource[];
            const rsNames = new Set(
              allRS
                .filter((rs) =>
                  (rs.metadata?.ownerReferences || []).some(
                    (ref) => ref.kind === 'Deployment' && ref.name === targetName
                  )
                )
                .map((rs) => rs.metadata?.name)
                .filter(Boolean)
            );

            matchedPods = allPods.filter((pod) =>
              (pod.metadata?.ownerReferences || []).some(
                (ref) => ref.kind === 'ReplicaSet' && rsNames.has(ref.name)
              )
            );
          } catch (err) {
            console.warn('Failed to fetch RS for HPA target:', err);
          }
        } else if (lowerTarget === 'statefulset') {
          matchedPods = allPods.filter((pod) =>
            (pod.metadata?.ownerReferences || []).some(
              (ref) => ref.kind === 'StatefulSet' && ref.name === targetName
            )
          );
        } else if (lowerTarget === 'replicaset') {
          matchedPods = allPods.filter((pod) =>
            (pod.metadata?.ownerReferences || []).some(
              (ref) => ref.kind === 'ReplicaSet' && ref.name === targetName
            )
          );
        }
      }

      // Fallback matching if owner reference match didn't find any
      if (matchedPods.length === 0 && targetName) {
        matchedPods = allPods.filter((pod) => {
          const podName = pod.metadata?.name || '';
          return podName.startsWith(`${targetName}-`);
        });
      }

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
        };
      });

      return {
        hpaItem,
        podsList
      };
    },
    enabled: !!cluster && !!payload?.ns && !!payload?.name,
    placeholderData: keepPreviousData,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000
  });

  if (!payload) {
    return <div className="p-4 text-xs text-zinc-500">No HPA details available.</div>;
  }

  const rawItem = (queryData?.hpaItem || payload.rawItem) as unknown as HpaRawResource | undefined;
  const pods = queryData?.podsList || [];

  const handleNamespaceClick = () => {
    if (payload.ns) {
      openNamespaceDetail(payload.ns);
    }
  };

  const refKind = rawItem?.spec?.scaleTargetRef?.kind || payload.referenceKind || '';
  const refName = rawItem?.spec?.scaleTargetRef?.name || payload.referenceName || '';

  const handleReferenceClick = () => {
    if (refKind && refName) {
      openResourceDetail(refKind, payload.ns, refName);
    }
  };

  const labels = rawItem?.metadata?.labels
    ? Object.entries(rawItem.metadata.labels)
    : payload.labels
      ? Object.entries(payload.labels)
      : [];
  const annotations = rawItem?.metadata?.annotations
    ? Object.entries(rawItem.metadata.annotations)
    : payload.annotations
      ? Object.entries(payload.annotations)
      : [];

  const createdTime = rawItem?.metadata?.creationTimestamp
    ? new Date(rawItem.metadata.creationTimestamp).toLocaleString()
    : payload.createdTime || '';

  const minPods = rawItem?.spec?.minReplicas ?? payload.minPods ?? 1;
  const maxPods = rawItem?.spec?.maxReplicas ?? payload.maxPods ?? 1;
  const currentReplicas = rawItem?.status?.currentReplicas ?? payload.replicas ?? 0;
  const desiredReplicas = rawItem?.status?.desiredReplicas ?? currentReplicas;

  // Build live metrics table if available
  const configuredMetrics: HpaMetric[] = [];
  if (rawItem?.spec?.targetCPUUtilizationPercentage !== undefined) {
    const currentVal =
      rawItem.status?.currentCPUUtilizationPercentage !== undefined
        ? `${rawItem.status.currentCPUUtilizationPercentage}%`
        : 'unknown';
    configuredMetrics.push({
      name: 'Resource cpu on Pods',
      current: currentVal,
      target: `${rawItem.spec.targetCPUUtilizationPercentage}%`
    });
  }

  const specMetrics = rawItem?.spec?.metrics || [];
  const statusMetrics = rawItem?.status?.currentMetrics || [];

  specMetrics.forEach((m) => {
    if (m.type === 'Resource' && m.resource) {
      const resName = m.resource.name;
      let targetVal = '—';
      if (m.resource.target) {
        if (m.resource.target.type === 'Utilization') {
          targetVal = `${m.resource.target.averageUtilization || 0}%`;
        } else if (m.resource.target.type === 'AverageValue') {
          targetVal = m.resource.target.averageValue || '0';
        }
      }
      let currentVal = 'unknown';
      const matchingStatus = statusMetrics.find(
        (sm) => sm.type === 'Resource' && sm.resource?.name === resName
      );
      if (matchingStatus && matchingStatus.resource?.current) {
        if (matchingStatus.resource.current.averageUtilization !== undefined) {
          currentVal = `${matchingStatus.resource.current.averageUtilization}%`;
        } else if (matchingStatus.resource.current.averageValue !== undefined) {
          currentVal = matchingStatus.resource.current.averageValue;
        }
      }
      configuredMetrics.push({
        name: `Resource ${resName} on Pods`,
        current: currentVal,
        target: targetVal
      });
    }
  });

  const displayMetrics = configuredMetrics.length > 0 ? configuredMetrics : payload.metrics || [];

  const conditions = rawItem?.status?.conditions || [];

  const propertiesData: PropertyItem[] = [
    {
      id: 'created',
      name: 'Created',
      value: (
        <span>
          <Age
            timestamp={
              rawItem?.metadata?.creationTimestamp ||
              ((payload as unknown as Record<string, unknown>).creationTimestamp as string)
            }
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
          className="font-mono text-accent hover:underline cursor-pointer"
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
        <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto pr-1 select-text">
          {labels.map(([k, v]) => (
            <span
              key={k}
              className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-surface-3 border border-border/60 text-zinc-350 truncate max-w-full"
              title={`${k}=${v}`}
            >
              {k}={v}
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
        <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto pr-1 select-text">
          {annotations.map(([k, v]) => (
            <span
              key={k}
              className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-surface-3 border border-border/60 text-zinc-350 truncate max-w-full"
              title={`${k}=${v}`}
            >
              {k}={v}
            </span>
          ))}
        </div>
      )
    },
    {
      id: 'reference',
      name: 'Reference',
      value:
        refKind && refName ? (
          <span
            onClick={handleReferenceClick}
            className="font-mono text-accent hover:underline cursor-pointer"
            title={`Open ${refKind} ${refName} in new tab`}
          >
            {refKind}/{refName}
          </span>
        ) : (
          '—'
        )
    },
    {
      id: 'minPods',
      name: 'Min Pods',
      value: minPods
    },
    {
      id: 'maxPods',
      name: 'Max Pods',
      value: maxPods
    },
    {
      id: 'replicas',
      name: 'Replicas',
      value: `${currentReplicas} current / ${desiredReplicas} desired`
    },
    {
      id: 'status',
      name: 'Status',
      value: payload.statusText || '—'
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
            const badgeColor = isTrue
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
              : 'bg-zinc-800 border-border/80 text-zinc-400';
            return (
              <span
                key={c.type}
                className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono border ${badgeColor}`}
                title={c.message || c.reason}
              >
                {c.type}: {c.status}
              </span>
            );
          })}
        </div>
      )
    });
  }

  return (
    <div className={`flex flex-col gap-4 ${isTab ? 'p-6 h-full overflow-y-auto' : 'flex-1'}`}>
      {/* Properties Section */}
      <div className="flex flex-col gap-2.5 mt-1">
        <span className="text-[10px] font-bold text-zinc-455 uppercase tracking-wider mb-1">
          Properties
        </span>
        <KubePropertiesTable properties={propertiesData} />
      </div>

      {/* Configured Metrics Section */}
      <div className="flex flex-col gap-1.5 mt-2 border-t border-border-dark/60 pt-3">
        <span className="text-[10px] font-bold text-zinc-450 uppercase tracking-wider mb-1.5 font-sans">
          Configured Metrics
        </span>
        {displayMetrics.length > 0 ? (
          <div className="flex flex-col border-y border-border/40 bg-surface-2/30">
            <div className="flex items-center justify-between px-3 py-2 bg-surface-3/30 border-b border-border/30 text-[10px] font-bold text-zinc-500 uppercase font-mono">
              <span>Metric</span>
              <span>Current / Target</span>
            </div>
            <div className="flex flex-col divide-y divide-border/20 max-h-48 overflow-y-auto">
              {displayMetrics.map((m) => (
                <div key={m.name} className="flex items-center justify-between px-3 py-2 text-xs">
                  <span className="font-sans text-zinc-300 truncate mr-4" title={m.name}>
                    {m.name}
                  </span>
                  <span className="font-mono text-zinc-300 font-semibold shrink-0">
                    {m.current} <span className="text-zinc-555 font-normal">/</span> {m.target}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <span className="text-xs text-zinc-500 italic px-1">No metrics configured.</span>
        )}
      </div>

      {/* Target Pods Section */}
      {pods.length > 0 && (
        <div className="flex flex-col gap-2 mt-2 border-t border-border-dark/60 pt-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-zinc-455 uppercase tracking-wider">
              Target Pods ({pods.length})
            </span>
          </div>
          <div className="border-y border-border/40 flex flex-col max-h-[180px] h-auto w-full overflow-y-auto">
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
        </div>
      )}

      {/* Events Section */}
      <div className="flex flex-col gap-1.5 mt-2 border-t border-border-dark/60 pt-3">
        <span className="text-[10px] font-bold text-zinc-450 uppercase tracking-wider">Events</span>
        <div className="text-xs text-zinc-500 italic pl-1 mt-0.5">No events found</div>
      </div>
    </div>
  );
};
