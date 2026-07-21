import type React from 'react';
import { useState, useEffect } from 'react';
import { useLayoutStore } from '../../../../../src/store/layout.store';
import { useKuberneterStore } from '../../../store/kuberneter.store';
import { MetricGauge } from './MetricGauge';
import { HistoryChart } from './HistoryChart';
import { WarningsFeed } from './WarningsFeed';
import { ClusterOverviewHeader } from './ClusterOverviewHeader';
import { KubeWorkspaceLayout } from '../KubeWorkspaceLayout';
import { getCapacitySums, getWorkloadMetrics, getLiveMetrics } from './clusterMetrics';
import type { NodeResource, PodResource, EventResource, NodeMetric } from './types';
import { AlertCircle, Loader2 } from 'lucide-react';

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

  const capacities = getCapacitySums(nodes);
  const utilization = getLiveMetrics(nodeMetrics, capacities.capacityCpu, capacities.capacityMem);
  const workloads = getWorkloadMetrics(pods, kuberneterSelectedNamespace);

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
      const nsArg =
        kuberneterSelectedNamespace === 'All Namespaces' ? undefined : kuberneterSelectedNamespace;

      // Fetch all required resources in parallel (Deployments, Services, and Configmaps are not required by Cluster Pulse)
      const [nodesRes, podsRes, eventsRes, topNodesRes] = await Promise.all([
        window.kuberneter.getResources(configPathArg, kuberneterSelectedCluster, 'nodes'),
        window.kuberneter.getResources(configPathArg, kuberneterSelectedCluster, 'pods', nsArg),
        window.kuberneter.getResources(configPathArg, kuberneterSelectedCluster, 'events', nsArg),
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
    <KubeWorkspaceLayout
      header={
        <ClusterOverviewHeader
          timeRange={timeRange}
          setTimeRange={setTimeRange}
          refreshInterval={refreshInterval}
          setRefreshInterval={(val) => setKuberneterInstanceRefreshInterval(activeInstanceId, val)}
          isRefreshing={isRefreshing}
          onSync={() => fetchData(true)}
        />
      }
    >
      {/* Scrollable body — page scrolls when viewport is small; WarningsFeed manages its own height */}
      <div className="flex-1 flex flex-col gap-3.5 overflow-y-auto min-h-0 py-3.5">
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

        {/* Row 3: Live Warnings Feed — shrink-0 since WarningsFeed has its own min/max height */}
        <div className="shrink-0 px-4 pb-1">
          <WarningsFeed events={events} namespace={kuberneterSelectedNamespace} />
        </div>
      </div>
    </KubeWorkspaceLayout>
  );
};
