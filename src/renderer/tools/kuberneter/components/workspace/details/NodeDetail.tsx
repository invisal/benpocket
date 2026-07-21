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
import { parseK8sCapacity, formatCapacity } from '../../../utils/formatCapacity';
import {
  MoreVertical,
  Cpu,
  Layers,
  ArrowUpDown,
  Database,
  Flag,
  AlertTriangle
} from 'lucide-react';

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

  const [loading, setLoading] = useState(true);
  const [rawNode, setRawNode] = useState<NodeRawResource | null>(null);
  const [nodePods, setNodePods] = useState<PodRawResource[]>([]);
  const [topPods, setTopPods] = useState<
    { name?: string; namespace?: string; cpu?: string; memory?: string }[]
  >([]);

  // Metric options
  const [timeRange, setTimeRange] = useState('1h');
  const [selectedMetric, setSelectedMetric] = useState<'cpu' | 'memory' | 'network' | 'disk'>(
    'cpu'
  );

  const metricLabel = {
    cpu: 'CPU',
    memory: 'Memory',
    network: 'Network',
    disk: 'Disk'
  }[selectedMetric];

  // Fetch Node and Pods in parallel
  useEffect(() => {
    if (!cluster || !activeInstanceId || !payload.name) return;

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
          const foundNode = nodes.find((n) => n.metadata?.name === payload.name) as
            NodeRawResource | undefined;
          if (foundNode) {
            setRawNode(foundNode);
          }

          const pods = Array.isArray(podsRes?.items)
            ? (podsRes.items as unknown as PodRawResource[])
            : [];
          const filteredPods = pods.filter((p) => p.spec?.nodeName === payload.name);
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
  }, [cluster, configPath, activeInstanceId, payload.name]);

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
      value: payload.name
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
            payload.conditions === 'Ready'
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
          }`}
        >
          {payload.conditions}
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

  // SVG Chart Waveform generator
  const getSvgPoints = (seed: number) => {
    const width = 420;
    const height = 90;
    const pointsCount = 44;
    const arr = Array.from({ length: pointsCount }, (_, i) => {
      const h = Math.abs(Math.sin((i + seed) * 0.15)) * (height * 0.35);
      const x = (i / (pointsCount - 1)) * width;
      const y = height - (h + height * 0.1);
      return { x, y };
    });

    const linePath = arr
      .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
      .join(' ');
    const areaPath = `${linePath} L ${width} ${height} L 0 ${height} Z`;

    return { linePath, areaPath };
  };

  const chartPaths = useMemo(() => {
    return {
      usage: getSvgPoints(selectedMetric === 'cpu' ? 10 : 25),
      requests: getSvgPoints(selectedMetric === 'cpu' ? 18 : 32)
    };
  }, [selectedMetric]);

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
      let cpuVal = 0;
      if (metric?.cpu) {
        const rawCpu = metric.cpu.trim();
        if (rawCpu.endsWith('m')) {
          cpuVal = parseInt(rawCpu.slice(0, -1), 10);
        } else {
          cpuVal = parseFloat(rawCpu) * 1000;
        }
      }

      let memVal = 0;
      if (metric?.memory) {
        const rawMem = metric.memory.trim();
        if (rawMem.endsWith('Mi')) {
          memVal = parseInt(rawMem.slice(0, -2), 10);
        } else if (rawMem.endsWith('Gi')) {
          memVal = parseInt(rawMem.slice(0, -2), 10) * 1024;
        } else if (rawMem.endsWith('Ki')) {
          memVal = parseInt(rawMem.slice(0, -2), 10) / 1024;
        }
      }

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
              className="p-1 rounded hover:bg-surface-3 text-zinc-500 hover:text-white cursor-pointer border-none bg-transparent"
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
      <div className="flex flex-col bg-surface-2/40 border border-border/40 rounded-lg p-3 select-none">
        <div className="flex justify-between items-center pb-2 border-b border-border/40 mb-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-zinc-300 uppercase tracking-wider">
              Metrics
            </span>
            <MoreVertical className="size-3.5 text-zinc-600" />
          </div>
          <div className="flex items-center gap-1.5">
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="bg-surface-3 border border-border/60 rounded text-[10px] px-1 py-0.5 text-zinc-300 focus:outline-none focus:ring-0 cursor-pointer"
            >
              <option value="1h">1h</option>
              <option value="6h">6h</option>
              <option value="24h">24h</option>
              <option value="7d">7d</option>
            </select>

            <span className="h-4 w-px bg-border/40 mx-1" />

            <button
              onClick={() => setSelectedMetric('cpu')}
              title="CPU"
              className={`p-1 rounded cursor-pointer border-none bg-transparent transition-colors ${
                selectedMetric === 'cpu'
                  ? 'bg-accent/20 text-accent'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <Cpu className="size-3.5" />
            </button>
            <button
              onClick={() => setSelectedMetric('memory')}
              title="Memory"
              className={`p-1 rounded cursor-pointer border-none bg-transparent transition-colors ${
                selectedMetric === 'memory'
                  ? 'bg-accent/20 text-accent'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <Layers className="size-3.5" />
            </button>
            <button
              onClick={() => setSelectedMetric('network')}
              title="Network"
              className={`p-1 rounded cursor-pointer border-none bg-transparent transition-colors ${
                selectedMetric === 'network'
                  ? 'bg-accent/20 text-accent'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <ArrowUpDown className="size-3.5" />
            </button>
            <button
              onClick={() => setSelectedMetric('disk')}
              title="Disk"
              className={`p-1 rounded cursor-pointer border-none bg-transparent transition-colors ${
                selectedMetric === 'disk'
                  ? 'bg-accent/20 text-accent'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <Database className="size-3.5" />
            </button>

            <span className="h-4 w-px bg-border/40 mx-1" />

            <button
              title="Filter"
              className="p-1 rounded cursor-pointer border-none bg-transparent text-zinc-555"
            >
              <Flag className="size-3.5" />
            </button>
          </div>
        </div>

        <div className="text-[10px] text-zinc-500 mb-2 pl-0.5">
          Displaying metrics from Prometheus:{' '}
          <span className="text-accent/80 hover:underline cursor-pointer">monitoring</span> /{' '}
          <span className="text-accent/80 hover:underline cursor-pointer">
            prometheus-operated:9090
          </span>
        </div>

        {/* SVG Line Chart */}
        <div className="h-32 w-full bg-black/10 rounded border border-border-dark/30 relative flex flex-col justify-end p-2 pr-4">
          <div className="absolute left-2 top-2 bottom-6 flex flex-col justify-between text-[8px] font-mono text-zinc-650">
            <span>20.00</span>
            <span>15.00</span>
            <span>10.00</span>
            <span>5.00</span>
            <span>0</span>
          </div>

          <div className="ml-10 flex-1 relative border-b border-l border-zinc-800/60 overflow-hidden">
            {/* Horizontal Grid lines */}
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-20">
              <div className="border-t border-dashed border-zinc-500 h-0 w-full" />
              <div className="border-t border-dashed border-zinc-500 h-0 w-full" />
              <div className="border-t border-dashed border-zinc-500 h-0 w-full" />
              <div className="border-t border-dashed border-zinc-500 h-0 w-full" />
              <div className="border-t border-dashed border-zinc-500 h-0 w-full" />
            </div>

            <svg className="w-full h-full" viewBox="0 0 420 90" preserveAspectRatio="none">
              {/* CPU Capacity (Flat top line) */}
              <line x1="0" y1="18" x2="420" y2="18" stroke="#71717a" strokeWidth="1.5" />

              {/* CPU Allocatable Capacity (Flat top line, identical or slightly below) */}
              <line
                x1="0"
                y1="19"
                x2="420"
                y2="19"
                stroke="#4f46e5"
                strokeWidth="1.5"
                strokeDasharray="3,3"
              />

              {/* Area Under CPU Requests */}
              <path d={chartPaths.requests.areaPath} fill="#10b981" fillOpacity="0.05" />
              {/* CPU Requests Line */}
              <path
                d={chartPaths.requests.linePath}
                fill="none"
                stroke="#10b981"
                strokeWidth="1.5"
              />

              {/* Area Under CPU Usage */}
              <path d={chartPaths.usage.areaPath} fill="#3b82f6" fillOpacity="0.1" />
              {/* CPU Usage Line */}
              <path d={chartPaths.usage.linePath} fill="none" stroke="#3b82f6" strokeWidth="1.5" />
            </svg>
          </div>

          <div className="ml-10 flex justify-between text-[8px] font-mono text-zinc-650 pt-1">
            <span>11:12</span>
            <span>11:18</span>
            <span>11:24</span>
            <span>11:30</span>
            <span>11:36</span>
            <span>11:42</span>
            <span>11:48</span>
            <span>11:54</span>
            <span>12:00</span>
            <span>12:06</span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-4 text-[9px] text-zinc-400 mt-2 font-sans select-none">
          <div className="flex items-center gap-1">
            <span className="size-2 bg-blue-500 rounded-sm" />
            <span>{metricLabel} Usage</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="size-2 bg-emerald-500 rounded-sm" />
            <span>{metricLabel} Requests</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="size-2 bg-indigo-500 rounded-sm" />
            <span>{metricLabel} Allocatable Capacity</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="size-2 bg-zinc-500 rounded-sm" />
            <span>{metricLabel} Capacity</span>
          </div>
        </div>
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
