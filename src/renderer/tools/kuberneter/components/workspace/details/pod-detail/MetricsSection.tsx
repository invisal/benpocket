import type React from 'react';
import { useState, useEffect } from 'react';
import { RefreshCw, BarChart2 } from 'lucide-react';
import { EChartsMetricChart, type ChartSeries } from './EChartsMetricChart';
import { useLayoutStore } from '../../../../../../src/store/layout.store';
import { useKuberneterStore } from '../../../../store/kuberneter.store';

export type MetricCategory = 'cpu' | 'memory' | 'network' | 'filesystem';

interface MetricsSectionProps {
  podName: string;
  podNs: string;
}

interface MetricDataState {
  source?: string;
  timeLabels: string[];
  cpu: { usage: number[]; requests: number[]; limits: number[] };
  memory: { usage: number[]; requests: number[]; limits: number[] };
  network: { rx: number[]; tx: number[] };
  filesystem: { usage: number[]; limit: number[] };
}

export const MetricsSection: React.FC<MetricsSectionProps> = ({ podName, podNs }) => {
  const [category, setCategory] = useState<MetricCategory>('cpu');
  const [timeRange, setTimeRange] = useState<'1h' | '6h' | '24h'>('1h');
  const [loading, setLoading] = useState<boolean>(false);

  const activeInstanceId = useLayoutStore((s) => s.activeInstanceId);
  const kuberneterInstanceCluster = useKuberneterStore((s) => s.kuberneterInstanceCluster);
  const kuberneterInstanceConfigPath = useKuberneterStore((s) => s.kuberneterInstanceConfigPath);

  const cluster = activeInstanceId ? kuberneterInstanceCluster[activeInstanceId] : undefined;
  const configPath = activeInstanceId ? kuberneterInstanceConfigPath[activeInstanceId] : undefined;

  const [metricData, setMetricData] = useState<MetricDataState>({
    source: undefined,
    timeLabels: [],
    cpu: { usage: [], requests: [], limits: [] },
    memory: { usage: [], requests: [], limits: [] },
    network: { rx: [], tx: [] },
    filesystem: { usage: [], limit: [] }
  });

  useEffect(() => {
    let isCancelled = false;
    const fetchMetrics = async () => {
      setLoading(true);
      try {
        const res = await window.kuberneter.queryPodMetricsRange({
          kubeconfigPath: configPath === 'default' ? undefined : configPath,
          contextName: cluster || undefined,
          namespace: podNs,
          podName: podName,
          timeRange: timeRange
        });
        if (!isCancelled && res) {
          setMetricData({
            source: res.source,
            timeLabels: res.timeLabels || [],
            cpu: res.cpu || { usage: [], requests: [], limits: [] },
            memory: res.memory || { usage: [], requests: [], limits: [] },
            network: res.network || { rx: [], tx: [] },
            filesystem: res.filesystem || { usage: [], limit: [] }
          });
        }
      } catch {
        if (!isCancelled) {
          setMetricData({
            source: undefined,
            timeLabels: [],
            cpu: { usage: [], requests: [], limits: [] },
            memory: { usage: [], requests: [], limits: [] },
            network: { rx: [], tx: [] },
            filesystem: { usage: [], limit: [] }
          });
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    fetchMetrics();

    return () => {
      isCancelled = true;
    };
  }, [configPath, cluster, podNs, podName, timeRange]);

  if (!loading && metricData.timeLabels.length === 0) {
    return null;
  }

  let activeSeries: ChartSeries[] = [];
  let activeUnit = '';

  if (category === 'cpu') {
    activeUnit = 'cores';
    activeSeries = [
      { name: 'CPU Usage', color: '#3b82f6', data: metricData.cpu.usage },
      { name: 'CPU Requests', color: '#10b981', data: metricData.cpu.requests },
      { name: 'CPU Limits', color: '#6b7280', data: metricData.cpu.limits }
    ];
  } else if (category === 'memory') {
    activeUnit = 'MiB';
    activeSeries = [
      { name: 'Memory Usage', color: '#a855f7', data: metricData.memory.usage },
      { name: 'Memory Requests', color: '#10b981', data: metricData.memory.requests },
      { name: 'Memory Limits', color: '#6b7280', data: metricData.memory.limits }
    ];
  } else if (category === 'network') {
    activeUnit = 'KB/s';
    activeSeries = [
      { name: 'Receive (Rx)', color: '#06b6d4', data: metricData.network.rx },
      { name: 'Transmit (Tx)', color: '#f59e0b', data: metricData.network.tx }
    ];
  } else if (category === 'filesystem') {
    activeUnit = 'MiB';
    activeSeries = [
      { name: 'FS Usage', color: '#f43f5e', data: metricData.filesystem.usage },
      { name: 'FS Limit', color: '#6b7280', data: metricData.filesystem.limit }
    ];
  }

  return (
    <div className="flex flex-col gap-2 bg-surface-2/40 border border-border/40 rounded-lg p-3">
      {/* Header controls & tabs */}
      <div className="flex items-center justify-between gap-2 border-b border-border/40 pb-2 text-[10px]">
        {/* Category Tabs */}
        <div className="flex items-center gap-1 bg-surface-3 p-1 rounded-md border border-border">
          {(['cpu', 'memory', 'network', 'filesystem'] as MetricCategory[]).map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-2.5 py-1 rounded text-[10px] font-mono font-semibold uppercase tracking-wider transition-colors cursor-pointer border-none ${
                category === cat
                  ? 'bg-accent text-emphasis-text shadow-xs'
                  : 'text-muted-foreground hover:text-foreground hover:bg-surface-2 bg-transparent'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Time range & Refresh */}
        <div className="flex items-center gap-2">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as '1h' | '6h' | '24h')}
            className="bg-surface-3 border border-border text-foreground rounded px-2 py-1 text-[10px] outline-none cursor-pointer font-mono font-medium"
          >
            <option value="1h">1h</option>
            <option value="6h">6h</option>
            <option value="24h">24h</option>
          </select>
          <button
            onClick={() => {
              setLoading(true);
              window.kuberneter
                .queryPodMetricsRange({
                  kubeconfigPath: configPath === 'default' ? undefined : configPath,
                  contextName: cluster || undefined,
                  namespace: podNs,
                  podName: podName,
                  timeRange: timeRange
                })
                .then((res) => {
                  if (res && res.timeLabels) {
                    setMetricData({
                      source: res.source,
                      timeLabels: res.timeLabels || [],
                      cpu: res.cpu || { usage: [], requests: [], limits: [] },
                      memory: res.memory || { usage: [], requests: [], limits: [] },
                      network: res.network || { rx: [], tx: [] },
                      filesystem: res.filesystem || { usage: [], limit: [] }
                    });
                  }
                })
                .finally(() => setLoading(false));
            }}
            disabled={loading}
            className="p-1 text-muted-foreground hover:text-foreground cursor-pointer bg-transparent border-none transition-colors"
            title="Refresh metrics"
          >
            <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Discovered Data Source display */}
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-mono">
        <BarChart2 className="size-3 text-muted-foreground" />
        <span>
          Displaying metrics from Prometheus:{' '}
          <span className="text-accent underline font-medium cursor-pointer">
            {metricData.source || 'monitoring / prometheus-stack-kube-prom-prometheus:9090'}
          </span>
        </span>
      </div>

      {/* ECharts Instance */}
      <div className="w-full pt-1">
        <EChartsMetricChart
          timeLabels={metricData.timeLabels}
          series={activeSeries}
          unit={activeUnit}
          height={150}
        />
      </div>
    </div>
  );
};
