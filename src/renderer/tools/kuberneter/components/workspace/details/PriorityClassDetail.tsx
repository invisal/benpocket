import { Age } from '../../Age';
import type React from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { type PriorityClassData } from '../../../types/PriorityClassData';
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

interface PriorityClassDetailProps {
  payload: PriorityClassData;
  isTab?: boolean;
}

interface PriorityClassRawResource {
  metadata?: {
    name?: string;
    creationTimestamp?: string;
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
  };
  value?: number;
  globalDefault?: boolean;
  preemptionPolicy?: string;
  description?: string;
}

export const PriorityClassDetail: React.FC<PriorityClassDetailProps> = ({
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

  // Fetch fresh PriorityClass and matching Pods across cluster
  const { data: queryData } = useQuery({
    queryKey: ['kuberneter', 'priorityclass-detail-data', rawConfigPath, cluster, payload?.name],
    queryFn: async () => {
      if (!cluster || !payload?.name) return null;
      const configPathArg = rawConfigPath === 'default' ? undefined : rawConfigPath;

      const [pcRes, podsRes] = await Promise.all([
        window.kuberneter.getResources(configPathArg, cluster, K8S_RESOURCE_KEYS.PRIORITY_CLASSES),
        window.kuberneter.getResources(configPathArg, cluster, K8S_RESOURCE_KEYS.PODS)
      ]);

      const pcItem = ((pcRes?.items || []) as K8sResource[]).find(
        (i) => i.metadata?.name === payload.name
      );
      const allPods = (podsRes?.items || []) as K8sResource[];

      // Pods with spec.priorityClassName === payload.name
      const matchedPods = allPods.filter((pod) => {
        const podPriorityClass = (pod.spec as { priorityClassName?: string })?.priorityClassName;
        return podPriorityClass === payload.name;
      });

      const podsList: DeployRelatedPod[] = matchedPods.map((pod) => {
        const podName = pod.metadata?.name || '';
        const ns = pod.metadata?.namespace || '';
        const node = (pod.spec?.nodeName as string) || '—';
        const containerStatuses =
          (pod.status?.containerStatuses as Array<{ ready?: boolean }>) || [];
        const readyCount = containerStatuses.filter((c) => c.ready).length;
        const totalCount = containerStatuses.length;
        const phase = (pod.status?.phase as string) || 'Unknown';
        return {
          name: podName,
          node,
          ns,
          ready: `${readyCount}/${totalCount}`,
          cpu: 'N/A',
          memory: 'N/A',
          status: phase,
          hasWarning: phase !== 'Running' && phase !== 'Succeeded',
          rawItem: pod
        };
      });

      return {
        pcItem,
        podsList
      };
    },
    enabled: !!cluster && !!payload?.name,
    placeholderData: keepPreviousData,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000
  });

  if (!payload) {
    return <div className="p-4 text-sm text-zinc-500">No PriorityClass details available.</div>;
  }

  const rawItem = (queryData?.pcItem || payload.rawItem) as unknown as
    PriorityClassRawResource | undefined;
  const pods = queryData?.podsList || [];

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

  const value = rawItem?.value ?? payload.value ?? 0;
  const globalDefault = rawItem?.globalDefault ?? payload.globalDefault ?? false;
  const preemptionPolicy =
    rawItem?.preemptionPolicy || payload.preemptionPolicy || 'PreemptLowerPriority';
  const description = rawItem?.description || payload.description || '';

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
      id: 'value',
      name: 'Value',
      value: <span className="font-mono font-semibold text-zinc-200">{value.toLocaleString()}</span>
    },
    {
      id: 'globalDefault',
      name: 'Global Default',
      value: (
        <span
          className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono border ${
            globalDefault
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
              : 'bg-surface-3 border-border/60 text-zinc-400'
          }`}
        >
          {globalDefault ? 'true' : 'false'}
        </span>
      )
    },
    {
      id: 'preemptionPolicy',
      name: 'Preemption Policy',
      value: <span className="font-mono text-zinc-300">{preemptionPolicy}</span>
    }
  ];

  if (description) {
    propertiesData.push({
      id: 'description',
      name: 'Description',
      value: description
    });
  }

  propertiesData.push(
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
    }
  );

  return (
    <div className={`flex flex-col gap-4 ${isTab ? 'p-6 h-full overflow-y-auto' : 'flex-1'}`}>
      {/* Properties Section */}
      <div className="flex flex-col gap-2.5 mt-1">
        <span className="text-[10px] font-bold text-zinc-450 uppercase tracking-wider mb-1">
          Properties
        </span>
        <KubePropertiesTable properties={propertiesData} />
      </div>

      {/* Associated Pods Section */}
      <div className="flex flex-col gap-2 mt-2 border-t border-border-dark/60 pt-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-zinc-455 uppercase tracking-wider">
            Associated Pods ({pods.length})
          </span>
        </div>
        {pods.length === 0 ? (
          <div className="text-sm text-zinc-500 italic pl-1">
            No pods currently using this PriorityClass
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
                  key: 'ns',
                  header: 'Namespace',
                  className: 'py-2 px-3 text-accent hover:underline cursor-pointer',
                  render: (row) => (
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        openNamespaceDetail(row.ns);
                      }}
                    >
                      {row.ns}
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
                  key: 'ready',
                  header: 'Ready',
                  className: 'py-2 px-3 text-zinc-300'
                },
                {
                  key: 'cpu',
                  header: 'CPU',
                  className: 'py-2 px-3 font-mono text-zinc-300 text-sm',
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
                  className: 'py-2 px-3 font-mono text-zinc-300 text-sm',
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
              getRowKey={(row) => `${row.ns}/${row.name}`}
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
        <span className="text-[10px] font-bold text-zinc-455 uppercase tracking-wider">Events</span>
        <div className="text-sm text-zinc-500 italic pl-1 mt-0.5">No events found</div>
      </div>
    </div>
  );
};
