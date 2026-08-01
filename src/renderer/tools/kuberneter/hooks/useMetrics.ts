import { useQuery } from '@tanstack/react-query';
import { useLayoutStore } from '../../../src/store/layout.store';
import { useKuberneterStore, DEFAULT_METRICS_CONFIG } from '../store/kuberneter.store';
import { parseK8sCapacity, formatCapacity, parseCpu } from '../utils/formatCapacity';

// ─── Query key factories ──────────────────────────────────────────────────────

export const metricsKeys = {
  instant: (configPath: string, cluster: string, metricsConfigKey: string) =>
    ['kuberneter', 'metrics', 'instant', configPath, cluster, metricsConfigKey] as const,

  range: (
    configPath: string,
    cluster: string,
    namespace: string,
    podName: string,
    timeRange: string,
    metricsConfigKey: string
  ) =>
    [
      'kuberneter',
      'metrics',
      'range',
      configPath,
      cluster,
      namespace,
      podName,
      timeRange,
      metricsConfigKey
    ] as const
};

// ─── Shared context selector ──────────────────────────────────────────────────

function useMetricsContext() {
  const activeInstanceId = useLayoutStore((s) => s.activeInstanceId);
  const cluster = useKuberneterStore((s) => s.kuberneterInstanceCluster[activeInstanceId] || '');
  const rawConfigPath = useKuberneterStore(
    (s) => s.kuberneterInstanceConfigPath[activeInstanceId] || 'default'
  );
  const metricsConfig = useKuberneterStore(
    (s) => s.kuberneterMetricsConfig[cluster] ?? DEFAULT_METRICS_CONFIG
  );

  const configPath = rawConfigPath === 'default' ? undefined : rawConfigPath;
  const promConfig = {
    kubeconfigPath: configPath,
    contextName: cluster || undefined,
    provider: metricsConfig.provider,
    filterEmptyContainers: metricsConfig.filterEmptyContainers,
    useHttps: metricsConfig.useHttps,
    pathPrefix: metricsConfig.pathPrefix
  };

  // Stable key representing the current metrics config (for cache invalidation)
  const metricsConfigKey = [
    metricsConfig.source,
    metricsConfig.provider,
    metricsConfig.filterEmptyContainers,
    metricsConfig.useHttps,
    metricsConfig.pathPrefix
  ].join(':');

  return { cluster, configPath, metricsConfig, promConfig, metricsConfigKey };
}

// ─── Instant metrics (pod list) ───────────────────────────────────────────────

export interface InstantPodMetric {
  namespace: string;
  name: string;
  cpu: string;
  memory: string;
}

async function fetchInstantMetrics(
  source: string,
  promConfig: {
    kubeconfigPath: string | undefined;
    contextName: string | undefined;
    provider: string;
    filterEmptyContainers: boolean;
    useHttps: boolean;
    pathPrefix: string;
  },
  configPath: string | undefined,
  cluster: string
): Promise<InstantPodMetric[]> {
  if (source === 'none') return [];

  // Try Prometheus when source allows it
  if (source === 'auto' || source === 'prometheus') {
    try {
      const res = await window.kuberneter.queryPrometheus(promConfig);
      if (res.items && res.items.length > 0) return res.items;
      if (source === 'prometheus') return []; // explicit Prometheus mode — don't fall back
    } catch {
      if (source === 'prometheus') return [];
    }
  }

  // Metrics-server (explicit or auto fallback)
  if (source === 'auto' || source === 'metrics-server') {
    try {
      const res = await window.kuberneter.getTopPods(configPath, cluster || undefined);
      return res.items ?? [];
    } catch {
      return [];
    }
  }

  return [];
}

export function useInstantMetrics(enabled: boolean) {
  const { cluster, configPath, metricsConfig, promConfig, metricsConfigKey } = useMetricsContext();

  return useQuery({
    queryKey: metricsKeys.instant(configPath ?? 'default', cluster, metricsConfigKey),
    queryFn: () => fetchInstantMetrics(metricsConfig.source, promConfig, configPath, cluster),
    enabled: enabled && !!cluster,
    staleTime: 30_000,
    gcTime: 60_000
  });
}

// ─── Pod metrics range (pod detail charts) ────────────────────────────────────

export interface PodMetricsRange {
  source?: string;
  timeLabels: string[];
  cpu: { usage: number[]; requests: number[]; limits: number[] };
  memory: { usage: number[]; requests: number[]; limits: number[] };
  network: { rx: number[]; tx: number[] };
  filesystem: { usage: number[]; limit: number[] };
}

const EMPTY_RANGE: PodMetricsRange = {
  timeLabels: [],
  cpu: { usage: [], requests: [], limits: [] },
  memory: { usage: [], requests: [], limits: [] },
  network: { rx: [], tx: [] },
  filesystem: { usage: [], limit: [] }
};

async function fetchPodMetricsRange(
  source: string,
  promConfig: {
    kubeconfigPath: string | undefined;
    contextName: string | undefined;
    provider: string;
    filterEmptyContainers: boolean;
    useHttps: boolean;
    pathPrefix: string;
  },
  namespace: string,
  podName: string,
  timeRange: '1h' | '6h' | '24h'
): Promise<PodMetricsRange> {
  // Range metrics require Prometheus — metrics-server has no history
  if (source === 'none' || source === 'metrics-server') return EMPTY_RANGE;

  const res = await window.kuberneter.queryPodMetricsRange({
    ...promConfig,
    namespace,
    podName,
    timeRange
  });

  if (res.error || !res.timeLabels.length) return EMPTY_RANGE;
  return res;
}

export function usePodMetricsRange(
  namespace: string,
  podName: string,
  timeRange: '1h' | '6h' | '24h',
  enabled: boolean
) {
  const { cluster, configPath, metricsConfig, promConfig, metricsConfigKey } = useMetricsContext();

  return useQuery({
    queryKey: metricsKeys.range(
      configPath ?? 'default',
      cluster,
      namespace,
      podName,
      timeRange,
      metricsConfigKey
    ),
    queryFn: () =>
      fetchPodMetricsRange(metricsConfig.source, promConfig, namespace, podName, timeRange),
    enabled: enabled && !!cluster && !!namespace && !!podName,
    staleTime: 60_000,
    gcTime: 120_000
  });
}

// ─── Display helpers used by usePods.ts ──────────────────────────────────────

export function formatInstantCpu(raw: string): string {
  const millicores = parseCpu(raw);
  if (millicores === 0 && (!raw || raw === '0')) return '0.000';
  return (millicores / 1000).toFixed(3);
}

export function formatInstantMemory(raw: string): string {
  return formatCapacity(parseK8sCapacity(raw));
}
