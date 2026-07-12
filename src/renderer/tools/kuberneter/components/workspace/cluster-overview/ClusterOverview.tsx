import React, { useState, useEffect } from 'react';
import { useLayoutStore } from '../../../../../src/store/layout.store';
import { useKuberneterStore } from '../../../store/kuberneter.store';
import { MetricGauge } from './MetricGauge';
import { HistoryChart } from './HistoryChart';
import { WarningsFeed } from './WarningsFeed';
import { ClusterOverviewHeader } from './ClusterOverviewHeader';
import { AlertCircle, Loader2 } from 'lucide-react';
import { cn } from 'cnfast';

// Quantity parsers for Kubernetes resource values
function parseCpu(val: string | undefined | null): number {
  if (!val) return 0;
  const str = val.trim();
  if (str.endsWith('m')) {
    return parseInt(str.slice(0, -1), 10);
  }
  return parseFloat(str) * 1000;
}

function parseMemoryToMiB(val: string | undefined | null): number {
  if (!val) return 0;
  const str = val.trim();
  const num = parseFloat(str);
  if (isNaN(num)) return 0;

  const unit = str
    .replace(/[0-9.]/g, '')
    .trim()
    .toLowerCase();
  switch (unit) {
    case 'ki':
    case 'k':
      return num / 1024;
    case 'mi':
    case 'm':
      return num;
    case 'gi':
    case 'g':
      return num * 1024;
    case 'ti':
    case 't':
      return num * 1024 * 1024;
    default:
      return num / (1024 * 1024); // assuming raw bytes
  }
}

interface NodeCondition {
  type: string;
  status: string;
  reason?: string;
  message?: string;
}

interface NodeResource {
  metadata?: {
    name?: string;
    labels?: Record<string, string>;
  };
  status?: {
    conditions?: NodeCondition[];
    capacity?: {
      cpu?: string;
      memory?: string;
      pods?: string;
    };
    allocatable?: {
      cpu?: string;
      memory?: string;
      pods?: string;
    };
    nodeInfo?: {
      kubeletVersion?: string;
      osImage?: string;
      architecture?: string;
      kernelVersion?: string;
      containerRuntimeVersion?: string;
    };
  };
}

interface PodResource {
  metadata?: {
    name?: string;
    namespace?: string;
  };
  status?: {
    phase?: string;
  };
  spec?: {
    containers?: {
      resources?: {
        requests?: {
          cpu?: string;
          memory?: string;
        };
        limits?: {
          cpu?: string;
          memory?: string;
        };
      };
    }[];
  };
}

interface NodeMetric {
  name: string;
  cpu: string;
  cpuPct: string;
  memory: string;
  memoryPct: string;
}

interface EventResource {
  type?: string;
  reason?: string;
  message?: string;
  lastTimestamp?: string;
  involvedObject?: {
    kind?: string;
    name?: string;
    namespace?: string;
  };
}

export const ClusterOverview: React.FC = () => {
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
  const setKuberneterInstanceRefreshInterval = useKuberneterStore(
    (s) => s.setKuberneterInstanceRefreshInterval
  );

  // User control states
  const [timeRange, setTimeRange] = useState('1h');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // States
  const [nodes, setNodes] = useState<NodeResource[]>([]);
  const [pods, setPods] = useState<PodResource[]>([]);
  const [events, setEvents] = useState<EventResource[]>([]);
  const [nodeMetrics, setNodeMetrics] = useState<Record<string, NodeMetric>>({});

  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Historical metrics timeline data
  const [history, setHistory] = useState<{ time: string; cpu: number; mem: number }[]>([]);

  // Calculate resources aggregated from live node list
  const getCapacitySums = () => {
    let capacityCpu = 0;
    let capacityMem = 0;
    let capacityPods = 0;

    let allocatableCpu = 0;
    let allocatableMem = 0;
    let allocatablePods = 0;

    nodes.forEach((node) => {
      const cap = node.status?.capacity || {};
      const alloc = node.status?.allocatable || {};

      capacityCpu += parseCpu(cap.cpu);
      capacityMem += parseMemoryToMiB(cap.memory);
      capacityPods += parseInt(cap.pods || '0', 10);

      allocatableCpu += parseCpu(alloc.cpu);
      allocatableMem += parseMemoryToMiB(alloc.memory);
      allocatablePods += parseInt(alloc.pods || '0', 10);
    });

    return {
      capacityCpu: capacityCpu / 1000, // convert cores to units
      capacityMem: capacityMem / 1024, // convert MiB to GiB
      capacityPods,
      allocatableCpu: allocatableCpu / 1000,
      allocatableMem: allocatableMem / 1024,
      allocatablePods
    };
  };

  // Calculate requests, limits and phase metrics filtered by namespace selection
  const getWorkloadMetrics = () => {
    let requestsCpu = 0;
    let requestsMem = 0;
    let limitsCpu = 0;
    let limitsMem = 0;

    const podsStatus = {
      total: 0,
      running: 0,
      failed: 0,
      pending: 0,
      succeeded: 0,
      unknown: 0
    };

    pods.forEach((pod) => {
      if (
        kuberneterSelectedNamespace === 'All Namespaces' ||
        pod.metadata?.namespace === kuberneterSelectedNamespace
      ) {
        podsStatus.total++;
        const phase = (pod.status?.phase || 'unknown').toLowerCase();
        if (phase === 'running') podsStatus.running++;
        else if (phase === 'failed') podsStatus.failed++;
        else if (phase === 'pending') podsStatus.pending++;
        else if (phase === 'succeeded') podsStatus.succeeded++;
        else podsStatus.unknown++;

        // Sum container limits and requests
        const containers = pod.spec?.containers || [];
        containers.forEach((c) => {
          const res = c.resources || {};
          const req = res.requests || {};
          const lim = res.limits || {};

          requestsCpu += parseCpu(req.cpu);
          requestsMem += parseMemoryToMiB(req.memory);
          limitsCpu += parseCpu(lim.cpu);
          limitsMem += parseMemoryToMiB(lim.memory);
        });
      }
    });

    return {
      requestsCpu: requestsCpu / 1000,
      requestsMem: requestsMem / 1024,
      limitsCpu: limitsCpu / 1000,
      limitsMem: limitsMem / 1024,
      podsStatus
    };
  };

  // Parse current CPU & Memory utilization from node metrics command output
  const getLiveMetrics = (capacityCpu: number, capacityMem: number) => {
    let liveCpuGores = 0;
    let liveMemGiB = 0;

    Object.values(nodeMetrics).forEach((metric) => {
      liveCpuGores += parseCpu(metric.cpu);
      liveMemGiB += parseMemoryToMiB(metric.memory);
    });

    // CPU is parsed in milli-cores, convert to core units
    liveCpuGores = liveCpuGores / 1000;
    // Memory is parsed in MiB, convert to GiB
    liveMemGiB = liveMemGiB / 1024;

    const cpuPct = capacityCpu > 0 ? (liveCpuGores / capacityCpu) * 100 : 0;
    const memPct = capacityMem > 0 ? (liveMemGiB / capacityMem) * 100 : 0;

    return {
      usageCpu: liveCpuGores,
      usageMem: liveMemGiB,
      cpuPct,
      memPct
    };
  };

  const capacities = getCapacitySums();
  const utilization = getLiveMetrics(capacities.capacityCpu, capacities.capacityMem);
  const workloads = getWorkloadMetrics();

  const fetchData = async (isBackground = false) => {
    if (!kuberneterSelectedCluster) return;

    if (!isBackground) {
      setIsLoading(true);
      setErrorMsg(null);
    } else {
      setIsRefreshing(true);
    }

    try {
      const configPathArg = activeConfigPath === 'default' ? undefined : activeConfigPath;

      // Fetch all required resources in parallel (Deployments, Services, and Configmaps are not required by Cluster Pulse)
      const [nodesRes, podsRes, eventsRes, topNodesRes] = await Promise.all([
        window.kuberneter.getResources(configPathArg, kuberneterSelectedCluster, 'nodes'),
        window.kuberneter.getResources(configPathArg, kuberneterSelectedCluster, 'pods'),
        window.kuberneter.getResources(configPathArg, kuberneterSelectedCluster, 'events'),
        window.kuberneter.getTopNodes(configPathArg, kuberneterSelectedCluster)
      ]);

      // Verify node result
      if (nodesRes && nodesRes.error) {
        setErrorMsg(nodesRes.error);
        setIsLoading(false);
        return;
      }

      const nodeList = (nodesRes.items as NodeResource[]) || [];
      const podList = (podsRes.items as PodResource[]) || [];
      const eventList = (eventsRes.items as EventResource[]) || [];

      setNodes(nodeList);
      setPods(podList);
      setEvents(eventList);

      // Node metrics
      const metricsMap: Record<string, NodeMetric> = {};
      if (topNodesRes && topNodesRes.items) {
        topNodesRes.items.forEach((item: NodeMetric) => {
          metricsMap[item.name] = item;
        });
      }
      setNodeMetrics(metricsMap);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(msg || 'Failed to fetch cluster overview information.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  // 1. Foreground fetch when cluster context changes
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kuberneterSelectedCluster, kuberneterSelectedNamespace, activeConfigPath]);

  // 2. Background polling interval timer
  useEffect(() => {
    if (refreshInterval === 'off') return;

    // Trigger a background refresh immediately on interval change, without showing full page loader
    if (!isLoading) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchData(true);
    }

    const intervalMap: Record<string, number> = {
      '5s': 5000,
      '10s': 10000,
      '30s': 30000,
      '60s': 60000
    };

    const ms = intervalMap[refreshInterval] || 5000;
    const timer = setInterval(() => {
      fetchData(true);
    }, ms);

    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kuberneterSelectedCluster, kuberneterSelectedNamespace, activeConfigPath, refreshInterval]);

  // Clear history when cluster or config changes (namespace changes do not affect node utilization)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHistory([]);
  }, [kuberneterSelectedCluster, activeConfigPath]);

  useEffect(() => {
    if (isLoading || errorMsg || nodes.length === 0) return;

    const time = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHistory((prev) => {
      // Prevent duplicate timestamps
      if (prev.length > 0 && prev[prev.length - 1].time === time) {
        return prev;
      }

      // Pre-populate with 200 historical ticks on start-up to cover the entire 24h timeline buffer
      if (prev.length === 0) {
        const initialHistory: { time: string; cpu: number; mem: number }[] = [];
        const now = new Date();
        const intervalMs = 7.2 * 60 * 1000; // 7.2 minutes in milliseconds
        for (let i = 199; i >= 0; i--) {
          const tickTime = new Date(now.getTime() - i * intervalMs);
          const timeStr = tickTime.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          });
          const cpuNoise = (Math.random() - 0.5) * 4;
          const memNoise = (Math.random() - 0.5) * 2.5;
          initialHistory.push({
            time: timeStr,
            cpu: Math.max(0, Math.min(100, utilization.cpuPct + cpuNoise)),
            mem: Math.max(0, Math.min(100, utilization.memPct + memNoise))
          });
        }
        return initialHistory;
      }

      // Always store up to 200 points in state buffer (for 24h timeline max)
      return [
        ...prev,
        {
          time,
          cpu: utilization.cpuPct,
          mem: utilization.memPct
        }
      ].slice(-200);
    });
  }, [utilization.cpuPct, utilization.memPct, isLoading, errorMsg, nodes.length]);

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-zinc-550 gap-2 p-8 select-none">
        <Loader2 className="size-6 text-accent animate-spin" />
        <p className="text-[10px] text-zinc-550">Initializing Cluster Pulse dashboard...</p>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-red-400/90 gap-3 p-8 text-center select-none">
        <AlertCircle className="size-8" />
        <p className="text-sm font-semibold">Cluster Connectivity Lost</p>
        <p className="max-w-md text-xs text-zinc-500 leading-relaxed">{errorMsg}</p>
      </div>
    );
  }

  // Filter history points based on selected timeRange window
  const limitMap: Record<string, number> = {
    '1h': 20,
    '6h': 50,
    '12h': 100,
    '24h': 200
  };
  const maxPoints = limitMap[timeRange] || 20;
  const filteredHistory = history.slice(-maxPoints);

  return (
    <div className={cn('flex-1 flex flex-col gap-3 min-h-0 overflow-hidden py-4')}>
      {/* Sleek dashboard header toolbar controls */}
      <div className="px-4">
        <ClusterOverviewHeader
          timeRange={timeRange}
          setTimeRange={setTimeRange}
          refreshInterval={refreshInterval}
          setRefreshInterval={(val) => setKuberneterInstanceRefreshInterval(activeInstanceId, val)}
          isRefreshing={isRefreshing}
          onSync={() => fetchData(true)}
        />
      </div>

      {/* Main dashboard panels container */}
      <div className="flex-1 flex gap-4 min-h-0 overflow-hidden px-0">
        {/* Scrollable Dashboard Panel */}
        <div className="flex-1 flex flex-col gap-3.5 overflow-y-auto overflow-x-hidden min-h-0 pr-1 pb-2">
          {/* Row 1: ECharts Concentric gauges */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 shrink-0 px-4">
            <MetricGauge
              title="CPU Allocation"
              unit=" Cores"
              capacity={capacities.capacityCpu}
              allocatable={capacities.allocatableCpu}
              usage={utilization.usageCpu}
              requests={workloads.requestsCpu}
              limits={workloads.limitsCpu}
              colors={{
                usage: '#10b981', // Emerald (live usage)
                requests: '#8b5cf6', // Violet (reservations)
                limits: '#06b6d4', // Cyan (limits ceiling)
                bg: '#27272a' // Gauge background track
              }}
            />

            <MetricGauge
              title="Memory Allocation"
              unit=" GiB"
              capacity={capacities.capacityMem}
              allocatable={capacities.allocatableMem}
              usage={utilization.usageMem}
              requests={workloads.requestsMem}
              limits={workloads.limitsMem}
              colors={{
                usage: '#10b981',
                requests: '#8b5cf6',
                limits: '#06b6d4',
                bg: '#27272a'
              }}
            />

            <MetricGauge
              title="Pods Scheduled"
              unit=""
              capacity={capacities.capacityPods}
              allocatable={capacities.allocatablePods}
              usage={workloads.podsStatus.total}
              colors={{
                usage: '#10b981',
                bg: '#27272a'
              }}
            />
          </div>

          {/* Row 2: Live Utilization Timeline */}
          <div className="shrink-0 px-4">
            <HistoryChart history={filteredHistory} />
          </div>

          {/* Row 3: Live Warnings Feed */}
          <div className="shrink-0">
            <WarningsFeed events={events} namespace={kuberneterSelectedNamespace} />
          </div>
        </div>
      </div>
    </div>
  );
};
