import { Age } from '../../Age';
import type React from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { type PodDisruptionBudgetData } from '../../../types/PodDisruptionBudgetData';
import { type DeployRelatedPod } from '../../../types/DeployData';
import { KubeTable } from '../../kubeTable';
import { KubePropertiesTable, type PropertyItem } from './KubePropertiesTable';
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

interface PodDisruptionBudgetDetailProps {
  payload: PodDisruptionBudgetData;
  isTab?: boolean;
}

interface PdbRawResource {
  metadata?: {
    name?: string;
    namespace?: string;
    creationTimestamp?: string;
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
  };
  spec?: {
    minAvailable?: number | string;
    maxUnavailable?: number | string;
    selector?: {
      matchLabels?: Record<string, string>;
      matchExpressions?: Array<{ key: string; operator: string; values?: string[] }>;
    };
  };
  status?: {
    currentHealthy?: number;
    desiredHealthy?: number;
    disruptionsAllowed?: number;
    expectedPods?: number;
    conditions?: Array<{
      type: string;
      status: string;
      reason?: string;
      message?: string;
    }>;
  };
}

export const PodDisruptionBudgetDetail: React.FC<PodDisruptionBudgetDetailProps> = ({
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

  const metricsQuery = useInstantMetrics(true);
  const metricItems = metricsQuery.data ?? [];

  // Fetch fresh PDB and matching Pods with React Query caching
  const { data: queryData } = useQuery({
    queryKey: ['kuberneter', 'pdb-detail-data', rawConfigPath, cluster, payload?.ns, payload?.name],
    queryFn: async () => {
      if (!cluster || !payload?.ns || !payload?.name) return null;
      const configPathArg = rawConfigPath === 'default' ? undefined : rawConfigPath;

      const [pdbRes, podsRes] = await Promise.all([
        window.kuberneter.getResources(
          configPathArg,
          cluster,
          K8S_RESOURCE_KEYS.POD_DISRUPTION_BUDGETS,
          payload.ns
        ),
        window.kuberneter.getResources(configPathArg, cluster, K8S_RESOURCE_KEYS.PODS, payload.ns)
      ]);

      const pdbItem = ((pdbRes?.items || []) as K8sResource[]).find(
        (i) => i.metadata?.name === payload.name
      );
      const allPods = (podsRes?.items || []) as K8sResource[];

      const matchLabels =
        (pdbItem?.spec as { selector?: { matchLabels?: Record<string, string> } })?.selector
          ?.matchLabels || {};

      // Match pods in namespace with PDB selector
      const matchedPods = allPods.filter((pod) => {
        if (pod.metadata?.namespace !== payload.ns) return false;
        const podLabels = pod.metadata?.labels || {};
        const labelEntries = Object.entries(matchLabels);
        if (labelEntries.length === 0) return false;
        return labelEntries.every(([k, v]) => podLabels[k] === v);
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
        };
      });

      return {
        pdbItem,
        podsList
      };
    },
    enabled: !!cluster && !!payload?.ns && !!payload?.name,
    placeholderData: keepPreviousData,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000
  });

  if (!payload) {
    return <div className="p-4 text-xs text-zinc-500">No PDB details available.</div>;
  }

  const rawItem = (queryData?.pdbItem || payload.rawItem) as unknown as PdbRawResource | undefined;
  const pods = queryData?.podsList || [];

  const handleNamespaceClick = () => {
    if (payload.ns) {
      openNamespaceDetail(payload.ns);
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

  const matchLabels = rawItem?.spec?.selector?.matchLabels
    ? Object.entries(rawItem.spec.selector.matchLabels)
    : [];

  const createdTime = rawItem?.metadata?.creationTimestamp
    ? new Date(rawItem.metadata.creationTimestamp).toLocaleString()
    : payload.createdTime || '';

  const minAvailable =
    rawItem?.spec?.minAvailable !== undefined
      ? String(rawItem.spec.minAvailable)
      : payload.minAvailable || 'N/A';
  const maxUnavailable =
    rawItem?.spec?.maxUnavailable !== undefined
      ? String(rawItem.spec.maxUnavailable)
      : payload.maxUnavailable || 'N/A';

  const currentHealthy = rawItem?.status?.currentHealthy ?? payload.currentHealthy ?? 0;
  const desiredHealthy = rawItem?.status?.desiredHealthy ?? payload.desiredHealthy ?? 0;
  const disruptionsAllowed = rawItem?.status?.disruptionsAllowed ?? payload.disruptionsAllowed;
  const expectedPods = rawItem?.status?.expectedPods ?? payload.expectedPods;

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
      id: 'selector',
      name: 'Selector',
      value:
        matchLabels.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {matchLabels.map(([k, v]) => (
              <span
                key={k}
                className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-surface-3 border border-border/70 text-zinc-300"
              >
                {k}={v}
              </span>
            ))}
          </div>
        ) : (
          payload.selector || '—'
        )
    },
    {
      id: 'minAvailable',
      name: 'Min Available',
      value: minAvailable
    },
    {
      id: 'maxUnavailable',
      name: 'Max Unavailable',
      value: maxUnavailable
    },
    {
      id: 'currentHealthy',
      name: 'Current Healthy',
      value: <span className="font-semibold text-emerald-400 font-mono">{currentHealthy}</span>
    },
    {
      id: 'desiredHealthy',
      name: 'Desired Healthy',
      value: <span className="font-semibold text-zinc-300 font-mono">{desiredHealthy}</span>
    }
  ];

  if (disruptionsAllowed !== undefined) {
    propertiesData.push({
      id: 'disruptionsAllowed',
      name: 'Disruptions Allowed',
      value: (
        <span
          className={`font-semibold font-mono ${
            disruptionsAllowed > 0 ? 'text-emerald-400' : 'text-amber-400'
          }`}
        >
          {disruptionsAllowed}
        </span>
      )
    });
  }

  if (expectedPods !== undefined) {
    propertiesData.push({
      id: 'expectedPods',
      name: 'Total Expected Pods',
      value: <span className="font-mono">{expectedPods}</span>
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
        <span className="text-[10px] font-bold text-zinc-450 uppercase tracking-wider mb-1">
          Properties
        </span>
        <KubePropertiesTable properties={propertiesData} />
      </div>

      {/* Matching Pods Section */}
      <div className="flex flex-col gap-2 mt-2 border-t border-border-dark/60 pt-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-zinc-455 uppercase tracking-wider">
            Matching Pods ({pods.length})
          </span>
        </div>
        {pods.length === 0 ? (
          <div className="text-xs text-zinc-500 italic pl-1">
            No matching pods found in namespace
          </div>
        ) : (
          <div className="border-y border-border/40 flex flex-col max-h-[220px] h-auto w-full overflow-y-auto">
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
