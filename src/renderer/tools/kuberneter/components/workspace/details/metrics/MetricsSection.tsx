import type React from 'react';
import { useState } from 'react';
import {
  RefreshCw,
  BarChart2,
  Cpu,
  MemoryStick,
  Network,
  HardDrive,
  MoreVertical,
  Settings
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { EChartsMetricChart, type ChartSeries } from './EChartsMetricChart';
import { useLayoutStore } from '../../../../../../src/store/layout.store';
import { useKuberneterStore, DEFAULT_METRICS_CONFIG } from '../../../../store/kuberneter.store';
import { usePodMetricsRange, metricsKeys } from '../../../../hooks/useMetrics';
import { Menu } from '@renderer/components/ui/Menu';

export type MetricCategory = 'cpu' | 'memory' | 'network' | 'filesystem';

export interface MetricsSectionProps {
  podName?: string;
  podNs?: string;
  namespace?: string;
  resourceLabel?: string;
}

export const MetricsSection: React.FC<MetricsSectionProps> = ({
  podName,
  podNs,
  namespace,
  resourceLabel = 'resource'
}) => {
  const targetNs = namespace || podNs || '';
  const [category, setCategory] = useState<MetricCategory>('cpu');
  const [timeRange, setTimeRange] = useState<'1h' | '6h' | '24h'>('1h');

  const activeInstanceId = useLayoutStore((s) => s.activeInstanceId);
  const openTab = useLayoutStore((s) => s.openTab);
  const setKuberneterInstanceResource = useKuberneterStore((s) => s.setKuberneterInstanceResource);

  const cluster = useKuberneterStore((s) => s.kuberneterInstanceCluster[activeInstanceId] || '');
  const rawConfigPath = useKuberneterStore(
    (s) => s.kuberneterInstanceConfigPath[activeInstanceId] || 'default'
  );
  const metricsConfig = useKuberneterStore(
    (s) => s.kuberneterMetricsConfig[cluster] ?? DEFAULT_METRICS_CONFIG
  );

  const handleOpenMetricsSettings = () => {
    if (activeInstanceId) {
      setKuberneterInstanceResource(activeInstanceId, 'settings');
      openTab({
        id: `kuberneter-k8s-settings-${activeInstanceId}`,
        title: 'Settings',
        type: 'kuberneter',
        instanceId: activeInstanceId,
        meta: { resource: 'settings', section: 'metrics' }
      });
    }
  };

  const configPath = rawConfigPath === 'default' ? undefined : rawConfigPath;
  const metricsConfigKey = [
    metricsConfig.source,
    metricsConfig.provider,
    metricsConfig.filterEmptyContainers,
    metricsConfig.useHttps,
    metricsConfig.pathPrefix
  ].join(':');

  const queryClient = useQueryClient();

  const { data, isFetching } = usePodMetricsRange(
    targetNs,
    podName || '',
    timeRange,
    !!podName && !!targetNs
  );

  const targetName = podName || '';

  const ALL_CATEGORIES: MetricCategory[] = ['cpu', 'memory', 'network', 'filesystem'];
  const hiddenSet = new Set(metricsConfig.hiddenMetrics || []);
  const visibleCategories = ALL_CATEGORIES.filter((cat) => !hiddenSet.has(cat) || cat === 'cpu');

  const activeCategory = visibleCategories.includes(category)
    ? category
    : (visibleCategories[0] ?? 'cpu');

  function handleRefresh() {
    if (!targetName || !targetNs) return;
    const key = metricsKeys.range(
      configPath ?? 'default',
      cluster,
      targetNs,
      targetName,
      timeRange,
      metricsConfigKey
    );
    void queryClient.invalidateQueries({ queryKey: key });
  }

  if (metricsConfig.source === 'none') return null;

  if (isFetching && !data?.timeLabels.length) {
    return (
      <div className="flex flex-col gap-2 bg-surface-2/40 border border-border/40 rounded-lg p-3 select-none">
        <div className="flex items-center justify-center gap-2 py-6 text-xs text-muted-foreground font-mono">
          <RefreshCw className="size-4 animate-spin text-accent" />
          <span>Loading metrics...</span>
        </div>
      </div>
    );
  }

  if (!targetName || !data?.timeLabels.length) {
    return (
      <div className="flex flex-col gap-2 bg-surface-2/40 border border-border/40 rounded-lg p-3 select-none">
        <div className="flex items-center justify-between gap-2 py-2 text-xs text-muted-foreground font-mono">
          <div className="flex items-center gap-2">
            <BarChart2 className="size-4 text-muted-foreground" />
            <span>
              No metric points available for this {resourceLabel} (Source:{' '}
              <span className="text-accent font-medium">{metricsConfig.provider}</span>)
            </span>
          </div>
          {targetName && (
            <button
              onClick={handleRefresh}
              className="flex items-center gap-1 px-2 py-1 rounded bg-surface-3 border border-border text-[10px] text-foreground hover:bg-surface-2 cursor-pointer transition-colors"
            >
              <RefreshCw className="size-3" />
              <span>Retry</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  let activeSeries: ChartSeries[] = [];
  let activeUnit = '';

  if (activeCategory === 'cpu') {
    activeUnit = 'cores';
    activeSeries = [
      { name: 'CPU Usage', color: '#3b82f6', data: data?.cpu.usage ?? [] },
      { name: 'CPU Requests', color: '#10b981', data: data?.cpu.requests ?? [] },
      { name: 'CPU Limits', color: '#6b7280', data: data?.cpu.limits ?? [] }
    ];
  } else if (activeCategory === 'memory') {
    activeUnit = 'MiB';
    activeSeries = [
      { name: 'Memory Usage', color: '#a855f7', data: data?.memory.usage ?? [] },
      { name: 'Memory Requests', color: '#10b981', data: data?.memory.requests ?? [] },
      { name: 'Memory Limits', color: '#6b7280', data: data?.memory.limits ?? [] }
    ];
  } else if (activeCategory === 'network') {
    activeUnit = 'KB/s';
    activeSeries = [
      { name: 'Receive (Rx)', color: '#06b6d4', data: data?.network.rx ?? [] },
      { name: 'Transmit (Tx)', color: '#f59e0b', data: data?.network.tx ?? [] }
    ];
  } else if (activeCategory === 'filesystem') {
    activeUnit = 'MiB';
    activeSeries = [
      { name: 'Disk Usage', color: '#f43f5e', data: data?.filesystem.usage ?? [] },
      { name: 'Disk Size', color: '#6b7280', data: data?.filesystem.limit ?? [] }
    ];
  }

  return (
    <div className="flex flex-col bg-surface-2/40 border border-border/40 rounded-lg p-3 select-none min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 pb-2 text-[10px] min-w-0">
        {/* Category Tabs on the Left */}
        <div className="flex items-center gap-1 shrink-0">
          {visibleCategories.map((cat) => {
            const isCpu = cat === 'cpu';
            const isMem = cat === 'memory';
            const isNet = cat === 'network';
            const isFs = cat === 'filesystem';

            const labelMap: Record<MetricCategory, string> = {
              cpu: 'CPU',
              memory: 'Memory',
              network: 'Network',
              filesystem: 'File System'
            };

            return (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                title={labelMap[cat]}
                className={`p-1.5 rounded-md transition-colors cursor-pointer border-none flex items-center justify-center ${
                  activeCategory === cat
                    ? 'bg-accent text-emphasis-text'
                    : 'text-muted-foreground hover:text-foreground hover:bg-surface-2 bg-transparent'
                }`}
              >
                {isCpu && <Cpu className="size-3.5 shrink-0" />}
                {isMem && <MemoryStick className="size-3.5 shrink-0" />}
                {isNet && <Network className="size-3.5 shrink-0" />}
                {isFs && <HardDrive className="size-3.5 shrink-0" />}
              </button>
            );
          })}
        </div>

        {/* Time range & Refresh on the Right */}
        <div className="flex items-center gap-1.5 shrink-0">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as '1h' | '6h' | '24h')}
            className="bg-surface-3 border border-border text-foreground rounded px-1.5 py-0.5 text-[10px] outline-none cursor-pointer font-mono font-medium"
          >
            <option value="1h">1h</option>
            <option value="6h">6h</option>
            <option value="24h">24h</option>
          </select>
          <button
            onClick={handleRefresh}
            disabled={isFetching}
            className="p-1 text-muted-foreground hover:text-foreground cursor-pointer bg-transparent border-none transition-colors"
            title="Refresh metrics"
          >
            <RefreshCw className={`size-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          </button>
          <Menu.Root>
            <Menu.Trigger
              className="p-1 text-muted-foreground hover:text-foreground cursor-pointer bg-transparent border-none transition-colors outline-none flex items-center justify-center rounded"
              title="Metrics options"
            >
              <MoreVertical className="size-3.5" />
            </Menu.Trigger>
            <Menu.Content align="end">
              <Menu.Item onClick={handleOpenMetricsSettings}>
                <Settings className="size-3.5 text-muted-foreground mr-1.5" />
                <span>Metrics Settings</span>
              </Menu.Item>
            </Menu.Content>
          </Menu.Root>
        </div>
      </div>

      <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-mono truncate min-w-0 pt-2 pb-1">
        <BarChart2 className="size-3 text-muted-foreground shrink-0" />
        <span className="truncate">
          Resource: <span className="text-accent font-medium">{data?.source ?? '—'}</span>
        </span>
      </div>

      <div className="w-full pt-1 min-w-0">
        <EChartsMetricChart
          timeLabels={data?.timeLabels ?? []}
          series={activeSeries}
          unit={activeUnit}
          height={150}
        />
      </div>
    </div>
  );
};
