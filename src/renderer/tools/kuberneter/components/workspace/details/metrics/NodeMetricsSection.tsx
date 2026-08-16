import type React from 'react';
import { useState } from 'react';
import {
  BarChart2,
  Cpu,
  MemoryStick,
  ArrowUpDown,
  HardDrive,
  RefreshCw,
  MoreVertical,
  Settings
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { EChartsMetricChart, type ChartSeries } from './EChartsMetricChart';
import { useLayoutStore } from '../../../../../../src/store/layout.store';
import { useKuberneterStore, DEFAULT_METRICS_CONFIG } from '../../../../store/kuberneter.store';
import { useNodeMetricsRange, metricsKeys } from '../../../../hooks/useMetrics';
import { useOpenResourceDetail } from '../../../../hooks/useOpenResourceDetail';
import { parseMetricSource } from '../../../../utils/parseMetricSource';
import { Menu } from '@renderer/components/ui/Menu';

export type NodeMetricCategory = 'cpu' | 'memory' | 'network' | 'filesystem';

export interface NodeMetricsSectionProps {
  nodeName: string;
}

export const NodeMetricsSection: React.FC<NodeMetricsSectionProps> = ({ nodeName }) => {
  const [category, setCategory] = useState<NodeMetricCategory>('cpu');
  const [timeRange, setTimeRange] = useState<'1h' | '6h' | '24h'>('1h');

  const activeInstanceId = useLayoutStore((s) => s.activeInstanceId);
  const openTab = useLayoutStore((s) => s.openTab);
  const setKuberneterInstanceResource = useKuberneterStore((s) => s.setKuberneterInstanceResource);
  const { openNamespaceDetail, openServiceDetail } = useOpenResourceDetail();

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
    metricsConfig.pathPrefix,
    metricsConfig.refreshInterval ?? 3
  ].join(':');

  const queryClient = useQueryClient();

  const { data, isFetching } = useNodeMetricsRange(nodeName, timeRange, !!nodeName);

  const ALL_CATEGORIES: NodeMetricCategory[] = ['cpu', 'memory', 'network', 'filesystem'];
  const hiddenSet = new Set(metricsConfig.hiddenMetrics || []);
  const visibleCategories = ALL_CATEGORIES.filter((cat) => !hiddenSet.has(cat) || cat === 'cpu');

  const activeCategory = visibleCategories.includes(category)
    ? category
    : (visibleCategories[0] ?? 'cpu');

  function handleRefresh() {
    if (!nodeName) return;
    const key = metricsKeys.range(
      configPath ?? 'default',
      cluster,
      'node',
      nodeName,
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
          <span>Loading node metrics...</span>
        </div>
      </div>
    );
  }

  if (!nodeName || !data?.timeLabels.length) {
    return (
      <div className="flex flex-col gap-2 bg-surface-2/40 border border-border/40 rounded-lg p-3 select-none">
        <div className="flex items-center justify-between gap-2 py-2 text-xs text-muted-foreground font-mono">
          <div className="flex items-center gap-2">
            <span>
              No node metrics available for <b className="text-foreground">{nodeName}</b> (source:{' '}
              <span className="text-accent font-medium">{metricsConfig.provider}</span>)
            </span>
          </div>
          {nodeName && (
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
      { name: 'CPU Usage', color: '#c084fc', data: data?.cpu.usage ?? [] },
      ...(data?.cpu.workloadUsage?.some((v) => v > 0)
        ? [{ name: 'Workload CPU Usage', color: '#38bdf8', data: data.cpu.workloadUsage }]
        : []),
      { name: 'CPU Requests', color: '#4ade80', data: data?.cpu.requests ?? [] },
      { name: 'CPU Limits', color: '#a855f7', data: data?.cpu.limits ?? [] },
      ...(data?.cpu.allocatable?.some((v) => v > 0)
        ? [{ name: 'CPU Allocatable Capacity', color: '#1d4ed8', data: data.cpu.allocatable }]
        : []),
      ...(data?.cpu.capacity?.some((v) => v > 0)
        ? [{ name: 'CPU Capacity', color: '#9ca3af', data: data.cpu.capacity }]
        : [])
    ];
  } else if (activeCategory === 'memory') {
    activeUnit = 'MiB';
    activeSeries = [
      { name: 'Memory Usage', color: '#c084fc', data: data?.memory.usage ?? [] },
      ...(data?.memory.workloadUsage?.some((v) => v > 0)
        ? [{ name: 'Workload Memory Usage', color: '#38bdf8', data: data.memory.workloadUsage }]
        : []),
      { name: 'Memory Requests', color: '#4ade80', data: data?.memory.requests ?? [] },
      { name: 'Memory Limits', color: '#a855f7', data: data?.memory.limits ?? [] },
      ...(data?.memory.allocatable?.some((v) => v > 0)
        ? [{ name: 'Memory Allocatable Capacity', color: '#1d4ed8', data: data.memory.allocatable }]
        : []),
      ...(data?.memory.capacity?.some((v) => v > 0)
        ? [{ name: 'Memory Capacity', color: '#9ca3af', data: data.memory.capacity }]
        : [])
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

            const labelMap: Record<NodeMetricCategory, string> = {
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
                {isNet && <ArrowUpDown className="size-3.5 shrink-0" />}
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
            className="bg-surface-3 border border-border rounded text-[10px] px-1.5 py-0.5 text-foreground focus:outline-none cursor-pointer"
          >
            <option value="1h">1h</option>
            <option value="6h">6h</option>
            <option value="24h">24h</option>
          </select>
          <button
            onClick={handleRefresh}
            title="Refresh metrics"
            disabled={isFetching}
            className="p-1 rounded bg-surface-3 border border-border text-foreground hover:bg-surface-2 disabled:opacity-50 cursor-pointer transition-colors flex items-center justify-center"
          >
            <RefreshCw className={`size-3 ${isFetching ? 'animate-spin' : ''}`} />
          </button>
          <Menu.Root>
            <Menu.Trigger
              render={
                <button
                  title="More actions"
                  className="p-1 rounded bg-surface-3 border border-border text-foreground hover:bg-surface-2 cursor-pointer transition-colors flex items-center justify-center"
                >
                  <MoreVertical className="size-3" />
                </button>
              }
            />
            <Menu.Content side="bottom" align="end" className="w-40">
              <Menu.Item onClick={handleOpenMetricsSettings} className="gap-2 text-xs">
                <Settings className="size-3.5 text-muted-foreground" />
                <span>Metrics Settings</span>
              </Menu.Item>
            </Menu.Content>
          </Menu.Root>
        </div>
      </div>

      <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-mono truncate min-w-0 pt-2 pb-1">
        <BarChart2 className="size-3 text-muted-foreground shrink-0" />
        <span className="truncate">
          Resource:{' '}
          {(() => {
            const parsedSource = parseMetricSource(data?.source);
            if (parsedSource) {
              return (
                <>
                  <span
                    onClick={() => openNamespaceDetail(parsedSource.namespace)}
                    className="text-accent font-medium hover:underline cursor-pointer"
                    title={`Open namespace "${parsedSource.namespace}" in new tab`}
                  >
                    {parsedSource.namespace}
                  </span>
                  <span className="text-muted-foreground mx-1">/</span>
                  <span
                    onClick={() => openServiceDetail(parsedSource.namespace, parsedSource.service)}
                    className="text-accent font-medium hover:underline cursor-pointer"
                    title={`Open service "${parsedSource.service}" in new tab`}
                  >
                    {parsedSource.service}
                  </span>
                  {parsedSource.port ? (
                    <span className="text-accent font-medium">:{parsedSource.port}</span>
                  ) : null}
                  {parsedSource.extra ? (
                    <span className="text-muted-foreground ml-1">{parsedSource.extra}</span>
                  ) : null}
                </>
              );
            }
            return <span className="text-accent font-medium">{data?.source ?? '—'}</span>;
          })()}
        </span>
      </div>

      <div className="w-full pt-1 min-w-0">
        <EChartsMetricChart
          timeLabels={data.timeLabels}
          series={activeSeries}
          unit={activeUnit}
          showLegend={false}
          height={150}
        />
      </div>
    </div>
  );
};
