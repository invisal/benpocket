import { NodeMetricsSection } from './metrics';
import { Age } from '../../Age';
import type React from 'react';
import { useState, useMemo, useEffect, useCallback } from 'react';
import { type NodeData } from '../../../types/NodeData';
import { KubePropertiesTable, type PropertyItem } from './KubePropertiesTable';
import { useLayoutStore } from '../../../../../src/store/layout.store';
import { useKuberneterStore } from '../../../store/kuberneter.store';
import { KubeTable } from '../../kubeTable';
import type { Column } from '../../kubeTable';
import { type K8sResource } from '../../../types/K8sResource';
import {
  parseK8sCapacity,
  formatCapacity,
  parseCpu,
  parseMemoryToMiB
} from '../../../utils/formatCapacity';
import { MoreVertical, AlertTriangle } from 'lucide-react';

interface NodeDetailProps {
  payload: NodeData;
  isTab?: boolean;
}

interface ResourceStatsRow {
  id: string;
  cpu: string;
  memory: string;
  ephemeralStorage: string;
  hugepages1G: string;
  hugepages2M: string;
  pods: string;
}

interface NodeAddress {
  type: string;
  address: string;
}

interface NodeCondition {
  type: string;
  status: string;
  message?: string;
}

interface NodeRawResource {
  metadata?: {
    name?: string;
    namespace?: string;
    creationTimestamp?: string;
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
  };
  status?: {
    addresses?: NodeAddress[];
    capacity?: Record<string, string>;
    allocatable?: Record<string, string>;
    nodeInfo?: {
      kubeletVersion?: string;
      operatingSystem?: string;
      architecture?: string;
      osImage?: string;
      kernelVersion?: string;
      containerRuntimeVersion?: string;
    };
    conditions?: NodeCondition[];
  };
}

interface PodRawResource {
  metadata?: {
    name?: string;
    namespace?: string;
  };
  spec?: {
    containers?: unknown[];
    nodeName?: string;
  };
  status?: {
    phase?: string;
    containerStatuses?: { ready: boolean; restartCount?: number }[];
  };
}

interface PodTableRow {
  id: string;
  name: string;
  hasWarning: boolean;
  node: string;
  namespace: string;
  ready: string;
  status: string;
  cpuVal: number;
  memVal: number;
  rawItem: PodRawResource;
}

export const NodeDetail: React.FC<NodeDetailProps> = ({ payload, isTab = false }) => {
  const activeInstanceId = useLayoutStore((s) => s.activeInstanceId);
  const setNamespace = useKuberneterStore((s) => s.setKuberneterInstanceNamespace);

  const cluster = useKuberneterStore((s) => s.kuberneterInstanceCluster[activeInstanceId] || '');
  const configPath = useKuberneterStore(
    (s) => s.kuberneterInstanceConfigPath[activeInstanceId] || 'default'
  );

  const nodeName = payload?.name || '';

  const [loading, setLoading] = useState(true);
  const [rawNode, setRawNode] = useState<NodeRawResource | null>(null);
  const [nodePods, setNodePods] = useState<PodRawResource[]>([]);
  const [topPods, setTopPods] = useState<
    { name?: string; namespace?: string; cpu?: string; memory?: string }[]
  >([]);

  // Fetch Node and Pods in parallel
  useEffect(() => {
    if (!cluster || !activeInstanceId || !nodeName) return;

    let active = true;

    const fetchAll = async () => {
      setLoading(true);
      try {
        const configPathArg = configPath === 'default' ? undefined : configPath;
        const [nodesRes, podsRes, topPodsRes] = await Promise.all([
          window.kuberneter.getResources(configPathArg, cluster, 'nodes'),
          window.kuberneter.getResources(configPathArg, cluster, 'pods'),
          window.kuberneter.getTopPods(configPathArg, cluster, 'All Namespaces')
        ]);

        if (active) {
          const nodes = Array.isArray(nodesRes?.items) ? (nodesRes.items as K8sResource[]) : [];
          const foundNode = nodes.find((n) => n.metadata?.name === nodeName) as
            NodeRawResource | undefined;
          if (foundNode) {
            setRawNode(foundNode);
          }

          const pods = Array.isArray(podsRes?.items)
            ? (podsRes.items as unknown as PodRawResource[])
            : [];
          const filteredPods = pods.filter((p) => p.spec?.nodeName === nodeName);
          setNodePods(filteredPods);

          const topPodsItems = Array.isArray(topPodsRes?.items)
            ? (topPodsRes.items as {
                name?: string;
                namespace?: string;
                cpu?: string;
                memory?: string;
              }[])
            : [];
          setTopPods(topPodsItems);
        }
      } catch (err) {
        console.error('Failed to load Node details and Pods:', err);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    fetchAll();

    return () => {
      active = false;
    };
  }, [cluster, configPath, activeInstanceId, nodeName]);

  const handleNamespaceClick = useCallback(
    (ns: string) => {
      if (ns && activeInstanceId) {
        setNamespace(activeInstanceId, ns);
      }
    },
    [activeInstanceId, setNamespace]
  );

  // Address details helper
  const addresses = rawNode?.status?.addresses || [];
  const ipAddress = addresses.find((a) => a.type === 'InternalIP')?.address || '—';
  const hostAddress = addresses.find((a) => a.type === 'Hostname')?.address || '—';

  // Capacity & Allocatable formatting
  const capacityStats = useMemo(() => {
    if (!rawNode) return null;
    const cap = rawNode.status?.capacity || {};
    return {
      cpu: cap.cpu || '0',
      memory: formatCapacity(parseK8sCapacity(cap.memory || '0')),
      ephemeralStorage: formatCapacity(parseK8sCapacity(cap['ephemeral-storage'] || '0')),
      hugepages1G: cap['hugepages-1Gi'] || '0',
      hugepages2M: cap['hugepages-2Mi'] || '0',
      pods: cap.pods || '0'
    };
  }, [rawNode]);

  const allocatableStats = useMemo(() => {
    if (!rawNode) return null;
    const alloc = rawNode.status?.allocatable || {};
    return {
      cpu: alloc.cpu || '0',
      memory: formatCapacity(parseK8sCapacity(alloc.memory || '0')),
      ephemeralStorage: formatCapacity(parseK8sCapacity(alloc['ephemeral-storage'] || '0')),
      hugepages1G: alloc['hugepages-1Gi'] || '0',
      hugepages2M: alloc['hugepages-2Mi'] || '0',
      pods: alloc.pods || '0'
    };
  }, [rawNode]);

  // Labels & Annotations lists
  const annotations = rawNode?.metadata?.annotations
    ? Object.entries(rawNode.metadata.annotations)
    : [];
  const labels = rawNode?.metadata?.labels ? Object.entries(rawNode.metadata.labels) : [];

  const propertiesData: PropertyItem[] = [
    {
      id: 'created',
      name: 'Created',
      value: (
        <span>
          <Age timestamp={rawNode?.metadata?.creationTimestamp as string} /> ago (
          {new Date(rawNode?.metadata?.creationTimestamp || '').toLocaleString() || 'N/A'})
        </span>
      )
    },
    {
      id: 'name',
      name: 'Name',
      value: nodeName
    },
    {
      id: 'labels',
      name: 'Labels',
      value: `${labels.length} Label${labels.length === 1 ? '' : 's'}`,
      hasDetail: labels.length > 0,
      renderDetail: () => (
        <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto pr-1 select-text">
          {labels.map(([k, v]) => (
            <span
              key={k}
              className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-surface-3 border border-border/60 text-zinc-350 truncate max-w-full"
              title={`${k}=${v as string}`}
            >
              {k}={v as string}
            </span>
          ))}
        </div>
      )
    },
    {
      id: 'annotations',
      name: 'Annotations',
      value: `${annotations.length} Annotation${annotations.length === 1 ? '' : 's'}`,
      hasDetail: annotations.length > 0,
      renderDetail: () => (
        <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto pr-1 select-text">
          {annotations.map(([k, v]) => (
            <span
              key={k}
              className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-surface-3 border border-border/60 text-zinc-350 truncate max-w-full"
              title={`${k}=${v as string}`}
            >
              {k}={v as string}
            </span>
          ))}
        </div>
      )
    },
    {
      id: 'addresses',
      name: 'Addresses',
      value: (
        <div className="font-sans text-[11px] text-zinc-300">
          <div>InternalIP: {ipAddress}</div>
          <div className="mt-0.5">Hostname: {hostAddress}</div>
        </div>
      )
    },
    {
      id: 'os',
      name: 'OS',
      value: `${rawNode?.status?.nodeInfo?.operatingSystem || 'linux'} (${rawNode?.status?.nodeInfo?.architecture || 'amd64'})`
    },
    {
      id: 'osImage',
      name: 'OS Image',
      value: rawNode?.status?.nodeInfo?.osImage || '—'
    },
    {
      id: 'kernelVersion',
      name: 'Kernel version',
      value: rawNode?.status?.nodeInfo?.kernelVersion || '—'
    },
    {
      id: 'containerRuntime',
      name: 'Container runtime',
      value: rawNode?.status?.nodeInfo?.containerRuntimeVersion || '—'
    },
    {
      id: 'kubeletVersion',
      name: 'Kubelet version',
      value: rawNode?.status?.nodeInfo?.kubeletVersion || '—'
    },
    {
      id: 'conditions',
      name: 'Conditions',
      value: (
        <span
          className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
            payload?.conditions === 'Ready'
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
          }`}
        >
          {payload?.conditions || 'Ready'}
        </span>
      )
    }
  ];

  const statsColumns = useMemo<Column<ResourceStatsRow>[]>(
    () => [
      {
        key: 'cpu',
        header: 'CPU',
        render: (row) => <span className="text-zinc-300 font-sans text-xs">{row.cpu}</span>,
        className: 'text-zinc-300 font-sans',
        initialWidth: 80
      },
      {
        key: 'memory',
        header: 'Memory',
        render: (row) => <span className="text-zinc-300 font-sans text-xs">{row.memory}</span>,
        className: 'text-zinc-300 font-sans',
        initialWidth: 100
      },
      {
        key: 'ephemeralStorage',
        header: 'Ephemeral Storage',
        render: (row) => (
          <span className="text-zinc-300 font-sans text-xs">{row.ephemeralStorage}</span>
        ),
        className: 'text-zinc-300 font-sans truncate',
        initialWidth: 140
      },
      {
        key: 'hugepages1G',
        header: 'Hugepages-1Gi',
        render: (row) => <span className="text-zinc-300 font-sans text-xs">{row.hugepages1G}</span>,
        className: 'text-zinc-300 font-sans',
        initialWidth: 120
      },
      {
        key: 'hugepages2M',
        header: 'Hugepages-2Mi',
        render: (row) => <span className="text-zinc-300 font-sans text-xs">{row.hugepages2M}</span>,
        className: 'text-zinc-300 font-sans',
        initialWidth: 120
      },
      {
        key: 'pods',
        header: 'Pods',
        render: (row) => <span className="text-zinc-300 font-sans text-xs">{row.pods}</span>,
        className: 'text-zinc-300 font-sans',
        initialWidth: 80
      }
    ],
    []
  );

  const capacityData = useMemo<ResourceStatsRow[]>(() => {
    if (!capacityStats) return [];
    return [{ id: 'capacity', ...capacityStats }];
  }, [capacityStats]);

  const allocatableData = useMemo<ResourceStatsRow[]>(() => {
    if (!allocatableStats) return [];
    return [{ id: 'allocatable', ...allocatableStats }];
  }, [allocatableStats]);

  // Pods table preparation
  const podsData = useMemo<PodTableRow[]>(() => {
    return nodePods.map((p, idx) => {
      const name = p.metadata?.name || '';
      const namespace = p.metadata?.namespace || '';
      const containerStatuses = p.status?.containerStatuses || [];
      const total = p.spec?.containers?.length || 0;
      const ready = containerStatuses.filter((c: { ready: boolean }) => c.ready).length;
      const readyStr = `${ready}/${total}`;

      const phase = p.status?.phase || 'Unknown';
      const hasWarning = phase !== 'Running' && phase !== 'Succeeded';

      // Find metric
      const metric = topPods.find((m) => m.name === name && m.namespace === namespace);
      const cpuVal = metric?.cpu ? parseCpu(metric.cpu) : 0;
      const memVal = metric?.memory ? parseMemoryToMiB(metric.memory) : 0;

      return {
        id: `${namespace}/${name}/${idx}`,
        name,
        hasWarning,
        node: p.spec?.nodeName || '',
        namespace,
        ready: readyStr,
        status: phase,
        cpuVal,
        memVal,
        rawItem: p
      };
    });
  }, [nodePods, topPods]);

  const podsColumns = useMemo<Column<PodTableRow>[]>(
    () => [
      {
        key: 'name',
        header: 'Name',
        render: (row) => (
          <span className="text-zinc-300 font-sans text-xs truncate block" title={row.name}>
            {row.name}
          </span>
        ),
        className: 'text-zinc-300 font-sans max-w-[200px] truncate',
        initialWidth: 200
      },
      {
        key: 'warning',
        header: (
          <div className="flex justify-center">
            <AlertTriangle className="size-3.5 text-zinc-500" />
          </div>
        ),
        render: (row) => (
          <div className="flex justify-center">
            {row.hasWarning && <AlertTriangle className="size-3.5 text-amber-500" />}
          </div>
        ),
        headerClassName: 'w-10 text-center',
        className: 'w-10 text-center',
        initialWidth: 40,
        resizable: false
      },
      {
        key: 'node',
        header: 'Node',
        render: (row) => <span className="text-zinc-400 font-sans text-xs">{row.node}</span>,
        className: 'text-zinc-400 font-sans max-w-[120px] truncate',
        initialWidth: 120
      },
      {
        key: 'namespace',
        header: 'Namespace',
        render: (row) => (
          <span
            onClick={(e) => {
              e.stopPropagation();
              handleNamespaceClick(row.namespace);
            }}
            className="text-accent hover:underline cursor-pointer font-sans text-xs"
          >
            {row.namespace}
          </span>
        ),
        className: 'text-accent font-sans max-w-[120px] truncate',
        initialWidth: 120
      },
      {
        key: 'ready',
        header: 'Ready',
        render: (row) => <span className="text-zinc-400 font-mono text-xs">{row.ready}</span>,
        className: 'text-zinc-400 font-mono',
        initialWidth: 60
      },
      {
        key: 'cpu_spark',
        header: 'CPU',
        sortValue: (row) => row.cpuVal,
        render: (row) => {
          const pct = Math.min(100, Math.max(3, (row.cpuVal / 1000) * 100));
          return (
            <div
              className="h-1.5 w-16 bg-zinc-800 rounded-full overflow-hidden relative"
              title={`${row.cpuVal}m`}
            >
              <div
                className="absolute top-0 left-0 h-full bg-zinc-650"
                style={{ width: `${pct}%` }}
              />
            </div>
          );
        },
        className: 'w-20',
        initialWidth: 80,
        resizable: false
      },
      {
        key: 'memory_spark',
        header: 'Memory',
        sortValue: (row) => row.memVal,
        render: (row) => {
          const pct = Math.min(100, Math.max(3, (row.memVal / 512) * 100));
          return (
            <div
              className="h-1.5 w-16 bg-zinc-800 rounded-full overflow-hidden relative"
              title={`${row.memVal}MiB`}
            >
              <div
                className="absolute top-0 left-0 h-full bg-indigo-500"
                style={{ width: `${pct}%` }}
              />
            </div>
          );
        },
        className: 'w-20',
        initialWidth: 80,
        resizable: false
      },
      {
        key: 'status',
        header: 'Status',
        render: (row) => (
          <span
            className={`text-[11px] font-medium ${
              row.status === 'Running' || row.status === 'Succeeded'
                ? 'text-emerald-400'
                : 'text-amber-400'
            }`}
          >
            {row.status}
          </span>
        ),
        className: 'text-xs',
        initialWidth: 80
      },
      {
        key: 'actions',
        header: (
          <div className="flex justify-center select-none">
            <MoreVertical className="size-3.5 text-zinc-555" />
          </div>
        ),
        render: () => (
          <div className="flex justify-center">
            <button
              onClick={(e) => e.stopPropagation()}
              className="p-1 rounded hover:bg-surface-3 text-zinc-500 hover:text-strong cursor-pointer border-none bg-transparent"
            >
              <MoreVertical className="size-3.5" />
            </button>
          </div>
        ),
        headerClassName: 'w-10 text-center',
        className: 'w-10 text-center',
        initialWidth: 40,
        resizable: false
      }
    ],
    [handleNamespaceClick]
  );

  return (
    <div className={`flex flex-col gap-4 ${isTab ? 'p-6 h-full overflow-y-auto' : 'flex-1'}`}>
      {/* Metrics Section */}
      <div className="flex flex-col gap-2">
        <span className="text-[10px] font-bold text-zinc-450 uppercase tracking-wider mb-1">
          Metrics
        </span>
        <NodeMetricsSection nodeName={nodeName} />
      </div>

      {/* Properties Section */}
      <div className="flex flex-col gap-2.5">
        <span className="text-[10px] font-bold text-zinc-450 uppercase tracking-wider mb-1">
          Properties
        </span>
        <KubePropertiesTable properties={propertiesData} />
      </div>

      {/* Capacity Section */}
      <div className="flex flex-col gap-2.5 mt-2 border-t border-border-dark/60 pt-3">
        <span className="text-[10px] font-bold text-zinc-450 uppercase tracking-wider mb-1">
          Capacity
        </span>
        {loading ? (
          <div className="text-xs text-zinc-500 italic pl-1">Loading capacity...</div>
        ) : capacityData.length === 0 ? (
          <div className="text-xs text-zinc-500 italic pl-1">No capacity data</div>
        ) : (
          <div className="border-y border-border/40 flex flex-col h-auto">
            <KubeTable<ResourceStatsRow>
              columns={statsColumns}
              data={capacityData}
              getRowKey={(row) => row.id}
              resizable={false}
            />
          </div>
        )}
      </div>

      {/* Allocatable Section */}
      <div className="flex flex-col gap-2.5 mt-2 border-t border-border-dark/60 pt-3">
        <span className="text-[10px] font-bold text-zinc-450 uppercase tracking-wider mb-1">
          Allocatable
        </span>
        {loading ? (
          <div className="text-xs text-zinc-500 italic pl-1">Loading allocatable...</div>
        ) : allocatableData.length === 0 ? (
          <div className="text-xs text-zinc-500 italic pl-1">No allocatable data</div>
        ) : (
          <div className="border-y border-border/40 flex flex-col h-auto">
            <KubeTable<ResourceStatsRow>
              columns={statsColumns}
              data={allocatableData}
              getRowKey={(row) => row.id}
              resizable={false}
            />
          </div>
        )}
      </div>

      {/* Pods Section */}
      <div className="flex flex-col gap-2.5 mt-2 border-t border-border-dark/60 pt-3">
        <span className="text-[10px] font-bold text-zinc-450 uppercase tracking-wider mb-2">
          Pods
        </span>
        {loading ? (
          <div className="text-xs text-zinc-500 italic pl-1">Loading pods on node...</div>
        ) : podsData.length === 0 ? (
          <div className="text-xs text-zinc-500 italic pl-1">No pods running on this node</div>
        ) : (
          <div className="border-y border-border/40 flex flex-col h-auto max-h-75">
            <KubeTable<PodTableRow>
              columns={podsColumns}
              data={podsData}
              getRowKey={(row) => row.id}
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
