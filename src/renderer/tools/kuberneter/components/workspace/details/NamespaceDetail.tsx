import { Age } from '../../Age';
import type React from 'react';
import { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { type NamespaceData } from '../../../types/NamespaceData';
import { type DeployRelatedPod } from '../../../types/DeployData';
import { KubePropertiesTable, type PropertyItem } from './KubePropertiesTable';
import { KubeTable } from '../../kubeTable';
import { MetricsSection } from './metrics';
import { Select } from '@renderer/components/ui/Select';
import { useInstantMetrics } from '../../../hooks/useMetrics';
import { useOpenPodDetail, useOpenNodeDetail } from '../../../hooks/open-detail';
import { useLayoutStore } from '../../../../../src/store/layout.store';
import { useKuberneterStore } from '../../../store/kuberneter.store';
import { K8S_RESOURCE_KEYS } from '../../../constants/k8sResources';
import { type K8sResource } from '../../../types/K8sResource';

interface NamespaceDetailProps {
  payload: NamespaceData;
  isTab?: boolean;
}

export const NamespaceDetail: React.FC<NamespaceDetailProps> = ({ payload, isTab = false }) => {
  const activeInstanceId = useLayoutStore((s) => s.activeInstanceId);
  const cluster = useKuberneterStore((s) => s.kuberneterInstanceCluster[activeInstanceId] || '');
  const rawConfigPath = useKuberneterStore(
    (s) => s.kuberneterInstanceConfigPath[activeInstanceId] || 'default'
  );

  const { openPodDetail } = useOpenPodDetail();
  const { openNodeDetail } = useOpenNodeDetail();

  const [selectedTarget, setSelectedTarget] = useState<string>('all');

  const metricsQuery = useInstantMetrics(true);
  const metricItems = metricsQuery.data ?? [];

  // Fetch full Namespace resource and its Pods with React Query caching
  const { data: queryData } = useQuery({
    queryKey: ['kuberneter', 'namespace-detail-data', rawConfigPath, cluster, payload?.name],
    queryFn: async () => {
      if (!cluster || !payload?.name) return null;
      const configPathArg = rawConfigPath === 'default' ? undefined : rawConfigPath;
      const [nsRes, podsRes] = await Promise.all([
        window.kuberneter.getResources(configPathArg, cluster, K8S_RESOURCE_KEYS.NAMESPACES),
        window.kuberneter
          .getResources(configPathArg, cluster, K8S_RESOURCE_KEYS.PODS, payload.name)
          .catch(() => ({ items: [] }))
      ]);

      const nsItem = ((nsRes?.items || []) as K8sResource[]).find(
        (i) => i.metadata?.name === payload.name
      );
      const allPods = (podsRes?.items || []) as K8sResource[];

      const podsList: DeployRelatedPod[] = allPods.map((pod) => {
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
          ns: payload.name,
          ready: `${readyCount}/${totalCount}`,
          cpu: 'N/A',
          memory: 'N/A',
          status: phase,
          hasWarning: phase !== 'Running' && phase !== 'Succeeded',
          rawItem: pod
        } as DeployRelatedPod & { rawItem?: K8sResource };
      });

      return {
        nsItem,
        podsList
      };
    },
    enabled: !!cluster && !!payload?.name,
    placeholderData: keepPreviousData,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000
  });

  if (!payload) {
    return <div className="p-4 text-xs text-zinc-500">No Namespace details available.</div>;
  }

  const pods = queryData?.podsList || payload?.podsList || [];
  const rawItem = queryData?.nsItem || payload.rawItem;

  const allPodNames = pods.map((p) => p.name);
  const targetPodNames =
    selectedTarget === 'all'
      ? allPodNames
      : pods.some((p) => p.name === selectedTarget)
        ? [selectedTarget]
        : allPodNames;

  const creationTimestamp = rawItem?.metadata?.creationTimestamp || payload.creationTimestamp || '';
  const createdTime =
    payload.createdTime ||
    (creationTimestamp ? new Date(creationTimestamp).toLocaleString() : 'N/A');

  const annotations = Object.entries(rawItem?.metadata?.annotations || payload.annotations || {});
  const labels = Object.entries(rawItem?.metadata?.labels || payload.labels || {});
  const statusPhase = (rawItem?.status?.phase as string) || payload.status || 'Active';

  const propertiesData: PropertyItem[] = [
    {
      id: 'created',
      name: 'Created',
      value: (
        <span>
          {creationTimestamp ? <Age timestamp={creationTimestamp} /> : payload.age || '—'} ago (
          {createdTime})
        </span>
      )
    },
    {
      id: 'name',
      name: 'Name',
      value: payload.name
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
      id: 'status',
      name: 'Status',
      value: (
        <span
          className={
            statusPhase === 'Active'
              ? 'text-emerald-500 font-semibold'
              : 'text-red-500 font-semibold'
          }
        >
          {statusPhase}
        </span>
      )
    }
  ];

  return (
    <div className={`flex flex-col gap-4 ${isTab ? 'p-6 h-full overflow-y-auto' : 'flex-1'}`}>
      {/* Live Metrics Section */}
      <div className="flex flex-col gap-2">
        {pods.length > 0 && (
          <div className="flex items-center justify-between px-1">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              Metrics
            </span>
            <Select.Root
              value={selectedTarget}
              onValueChange={(val) => val && setSelectedTarget(val)}
            >
              <Select.Trigger
                variant="outline"
                className="w-24 h-5 text-[10px] font-mono px-1.5 py-0 bg-surface-3 border border-border/60 rounded text-foreground flex items-center justify-between gap-1 outline-none shadow-none font-normal"
              >
                <Select.Value>
                  {(value: string) => (value === 'all' ? `All (${pods.length})` : value)}
                </Select.Value>
              </Select.Trigger>
              <Select.Content
                side="bottom"
                align="end"
                className="min-w-[140px] max-w-[260px] text-[10px] font-mono"
              >
                <Select.Item value="all" className="text-[10px] font-mono py-1 px-2">
                  <Select.ItemText>All ({pods.length})</Select.ItemText>
                </Select.Item>
                {pods.map((p) => (
                  <Select.Item
                    key={p.name}
                    value={p.name}
                    className="text-[10px] font-mono py-1 px-2 truncate"
                  >
                    <Select.ItemText className="truncate">{p.name}</Select.ItemText>
                  </Select.Item>
                ))}
              </Select.Content>
            </Select.Root>
          </div>
        )}
        <MetricsSection
          namespace={payload.name}
          podNames={targetPodNames}
          resourceLabel="namespace"
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
                  key: 'ready',
                  header: 'Ready',
                  className: 'py-2 px-3 text-zinc-400 font-mono'
                },
                {
                  key: 'status',
                  header: 'Status',
                  className: 'py-2 px-3',
                  render: (row) => {
                    const isOk = row.status === 'Running' || row.status === 'Succeeded';
                    return (
                      <span
                        className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          isOk
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-red-500/10 text-red-400 border border-red-500/20'
                        }`}
                      >
                        {row.status}
                      </span>
                    );
                  }
                },
                {
                  key: 'cpu',
                  header: 'CPU',
                  className: 'py-2 px-3 text-zinc-400 font-mono',
                  render: (row) => {
                    const m = metricItems.find(
                      (item) => item.namespace === payload.name && item.name === row.name
                    );
                    return m ? `${m.cpu}` : row.cpu || 'N/A';
                  }
                },
                {
                  key: 'memory',
                  header: 'Memory',
                  className: 'py-2 px-3 text-zinc-400 font-mono',
                  render: (row) => {
                    const m = metricItems.find(
                      (item) => item.namespace === payload.name && item.name === row.name
                    );
                    return m ? `${m.memory}` : row.memory || 'N/A';
                  }
                },
                {
                  key: 'age',
                  header: 'Age',
                  className: 'py-2 px-3 text-zinc-450 font-mono',
                  render: (row) => {
                    const raw = (row as unknown as { rawItem?: K8sResource }).rawItem;
                    const cTime = raw?.metadata?.creationTimestamp;
                    return cTime ? <Age timestamp={cTime} /> : '—';
                  }
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
