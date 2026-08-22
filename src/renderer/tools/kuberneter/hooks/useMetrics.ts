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
    pathPrefix: metricsConfig.pathPrefix,
    kubectlPath: useKuberneterStore.getState().kuberneterKubectlPath || undefined
  };

  // Stable key representing the current metrics config (for cache invalidation)
  const metricsConfigKey = [
    metricsConfig.source,
    metricsConfig.provider,
    metricsConfig.filterEmptyContainers,
    metricsConfig.useHttps,
    metricsConfig.pathPrefix,
    metricsConfig.refreshInterval ?? 3
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
  _promConfig: unknown,
  configPath: string | undefined,
  cluster: string
): Promise<InstantPodMetric[]> {
  if (source === 'none') return [];

  try {
    const res = await window.kuberneter.getTopPods(configPath, cluster || undefined);
    return res.items ?? [];
  } catch {
    return [];
  }
}

export function useInstantMetrics(enabled: boolean) {
  const { cluster, configPath, metricsConfig, promConfig, metricsConfigKey } = useMetricsContext();

  return useQuery({
    queryKey: metricsKeys.instant(configPath ?? 'default', cluster, metricsConfigKey),
    queryFn: () => fetchInstantMetrics(metricsConfig.source, promConfig, configPath, cluster),
    enabled: enabled && !!cluster,
    staleTime: 10_000,
    refetchInterval: 15_000,
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

export interface NodeMetricsRange {
  source?: string;
  timeLabels: string[];
  cpu: {
    usage: number[];
    workloadUsage?: number[];
    requests: number[];
    limits: number[];
    allocatable?: number[];
    capacity?: number[];
  };
  memory: {
    usage: number[];
    workloadUsage?: number[];
    requests: number[];
    limits: number[];
    allocatable?: number[];
    capacity?: number[];
  };
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

// In-memory rolling buffer for live metrics-server streaming
const liveMetricsBuffer = new Map<
  string,
  { timeLabels: string[]; cpuUsage: number[]; memUsage: number[] }
>();
const MAX_LIVE_SAMPLES = 60; // 3 minutes of 3-second samples

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
  if (source === 'none') return EMPTY_RANGE;

  // Handle metrics-server explicit selection & live streaming rolling buffer
  if (source === 'metrics-server') {
    try {
      const topRes = await window.kuberneter.getTopPods(
        promConfig.kubeconfigPath,
        promConfig.contextName,
        namespace
      );
      if (topRes && topRes.items) {
        const podItem = topRes.items.find(
          (p: { name: string; namespace: string }) => p.name === podName
        );
        if (podItem) {
          const nowStr = new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          });
          let cpuVal = 0;
          if (podItem.cpu.endsWith('m')) {
            cpuVal = (parseFloat(podItem.cpu.slice(0, -1)) || 0) / 1000;
          } else if (podItem.cpu.endsWith('n')) {
            cpuVal = (parseFloat(podItem.cpu.slice(0, -1)) || 0) / 1e9;
          } else {
            cpuVal = parseFloat(podItem.cpu) || 0;
          }

          let memVal = 0;
          if (podItem.memory.endsWith('Mi')) {
            memVal = parseFloat(podItem.memory.slice(0, -2)) || 0;
          } else if (podItem.memory.endsWith('Gi')) {
            memVal = (parseFloat(podItem.memory.slice(0, -2)) || 0) * 1024;
          } else if (podItem.memory.endsWith('Ki')) {
            memVal = (parseFloat(podItem.memory.slice(0, -2)) || 0) / 1024;
          } else {
            memVal = parseFloat(podItem.memory) || 0;
          }

          const cacheKey = `${promConfig.contextName ?? 'default'}:${namespace}:${podName}`;
          let buffer = liveMetricsBuffer.get(cacheKey);
          if (!buffer) {
            buffer = { timeLabels: [], cpuUsage: [], memUsage: [] };
            liveMetricsBuffer.set(cacheKey, buffer);
          }

          buffer.timeLabels.push(nowStr);
          buffer.cpuUsage.push(cpuVal);
          buffer.memUsage.push(memVal);

          if (buffer.timeLabels.length > MAX_LIVE_SAMPLES) {
            buffer.timeLabels.shift();
            buffer.cpuUsage.shift();
            buffer.memUsage.shift();
          }

          return {
            source: 'kube-system / metrics-server (apis/metrics.k8s.io/v1beta1 — live 3s stream)',
            timeLabels: [...buffer.timeLabels],
            cpu: { usage: [...buffer.cpuUsage], requests: [], limits: [] },
            memory: { usage: [...buffer.memUsage], requests: [], limits: [] },
            network: { rx: [], tx: [] },
            filesystem: { usage: [], limit: [] }
          };
        }
      }
    } catch {
      // Fall through to EMPTY_RANGE
    }
    return EMPTY_RANGE;
  }

  // Handle Prometheus queries (for 'auto' or 'prometheus')
  try {
    const res = await window.kuberneter.queryPodMetricsRange({
      ...promConfig,
      namespace,
      podName,
      timeRange
    });

    if (!res.error && res.timeLabels.length > 0) return res;
  } catch {
    // Try auto fallback to metrics-server below
  }

  // Auto mode fallback to metrics-server if Prometheus returned no data
  if (source === 'auto') {
    try {
      const topRes = await window.kuberneter.getTopPods(
        promConfig.kubeconfigPath,
        promConfig.contextName,
        namespace
      );
      if (topRes && topRes.items) {
        const podItem = topRes.items.find(
          (p: { name: string; namespace: string }) => p.name === podName
        );
        if (podItem) {
          const nowStr = new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          });
          let cpuVal = 0;
          if (podItem.cpu.endsWith('m')) {
            cpuVal = (parseFloat(podItem.cpu.slice(0, -1)) || 0) / 1000;
          } else if (podItem.cpu.endsWith('n')) {
            cpuVal = (parseFloat(podItem.cpu.slice(0, -1)) || 0) / 1e9;
          } else {
            cpuVal = parseFloat(podItem.cpu) || 0;
          }

          let memVal = 0;
          if (podItem.memory.endsWith('Mi')) {
            memVal = parseFloat(podItem.memory.slice(0, -2)) || 0;
          } else if (podItem.memory.endsWith('Gi')) {
            memVal = (parseFloat(podItem.memory.slice(0, -2)) || 0) * 1024;
          } else if (podItem.memory.endsWith('Ki')) {
            memVal = (parseFloat(podItem.memory.slice(0, -2)) || 0) / 1024;
          } else {
            memVal = parseFloat(podItem.memory) || 0;
          }

          const cacheKey = `${promConfig.contextName ?? 'default'}:${namespace}:${podName}`;
          let buffer = liveMetricsBuffer.get(cacheKey);
          if (!buffer) {
            buffer = { timeLabels: [], cpuUsage: [], memUsage: [] };
            liveMetricsBuffer.set(cacheKey, buffer);
          }

          buffer.timeLabels.push(nowStr);
          buffer.cpuUsage.push(cpuVal);
          buffer.memUsage.push(memVal);

          if (buffer.timeLabels.length > MAX_LIVE_SAMPLES) {
            buffer.timeLabels.shift();
            buffer.cpuUsage.shift();
            buffer.memUsage.shift();
          }

          return {
            source: 'kube-system / metrics-server (apis/metrics.k8s.io/v1beta1 — live 3s stream)',
            timeLabels: [...buffer.timeLabels],
            cpu: { usage: [...buffer.cpuUsage], requests: [], limits: [] },
            memory: { usage: [...buffer.memUsage], requests: [], limits: [] },
            network: { rx: [], tx: [] },
            filesystem: { usage: [], limit: [] }
          };
        }
      }
    } catch {
      // Return EMPTY_RANGE
    }
  }

  return EMPTY_RANGE;
}

interface PromQueryConfig {
  kubeconfigPath: string | undefined;
  contextName: string | undefined;
  provider: string;
  filterEmptyContainers: boolean;
  useHttps: boolean;
  pathPrefix: string;
}

export async function fetchMultiPodMetricsRange(
  source: string,
  promConfig: PromQueryConfig,
  namespace: string,
  podNames: string[],
  timeRange: '1h' | '6h' | '24h'
): Promise<PodMetricsRange> {
  if (podNames.length === 0) return EMPTY_RANGE;
  if (podNames.length === 1) {
    return fetchPodMetricsRange(source, promConfig, namespace, podNames[0], timeRange);
  }

  const podNamesRegex = podNames.join('|');

  if (source === 'metrics-server') {
    try {
      const topRes = await window.kuberneter.getTopPods(
        promConfig.kubeconfigPath,
        promConfig.contextName,
        namespace
      );
      if (topRes && topRes.items) {
        const podSet = new Set(podNames);
        const matchedItems = topRes.items.filter((p: { name: string; namespace: string }) =>
          podSet.has(p.name)
        );

        if (matchedItems.length > 0) {
          const nowStr = new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          });

          let totalCpuVal = 0;
          let totalMemVal = 0;

          for (const item of matchedItems) {
            let cpuVal = 0;
            if (item.cpu.endsWith('m')) {
              cpuVal = (parseFloat(item.cpu.slice(0, -1)) || 0) / 1000;
            } else if (item.cpu.endsWith('n')) {
              cpuVal = (parseFloat(item.cpu.slice(0, -1)) || 0) / 1e9;
            } else {
              cpuVal = parseFloat(item.cpu) || 0;
            }

            let memVal = 0;
            if (item.memory.endsWith('Mi')) {
              memVal = parseFloat(item.memory.slice(0, -2)) || 0;
            } else if (item.memory.endsWith('Gi')) {
              memVal = (parseFloat(item.memory.slice(0, -2)) || 0) * 1024;
            } else if (item.memory.endsWith('Ki')) {
              memVal = (parseFloat(item.memory.slice(0, -2)) || 0) / 1024;
            } else {
              memVal = parseFloat(item.memory) || 0;
            }

            totalCpuVal += cpuVal;
            totalMemVal += memVal;
          }

          const groupKey = [...podNames].sort().join(',');
          const cacheKey = `${promConfig.contextName ?? 'default'}:${namespace}:multi:${groupKey}`;
          let buffer = liveMetricsBuffer.get(cacheKey);
          if (!buffer) {
            buffer = { timeLabels: [], cpuUsage: [], memUsage: [] };
            liveMetricsBuffer.set(cacheKey, buffer);
          }

          buffer.timeLabels.push(nowStr);
          buffer.cpuUsage.push(totalCpuVal);
          buffer.memUsage.push(totalMemVal);

          if (buffer.timeLabels.length > MAX_LIVE_SAMPLES) {
            buffer.timeLabels.shift();
            buffer.cpuUsage.shift();
            buffer.memUsage.shift();
          }

          return {
            source: `kube-system / metrics-server (aggregated across ${matchedItems.length} pods)`,
            timeLabels: [...buffer.timeLabels],
            cpu: { usage: [...buffer.cpuUsage], requests: [], limits: [] },
            memory: { usage: [...buffer.memUsage], requests: [], limits: [] },
            network: { rx: [], tx: [] },
            filesystem: { usage: [], limit: [] }
          };
        }
      }
    } catch {
      // Fall through to EMPTY_RANGE
    }
    return EMPTY_RANGE;
  }

  // Prometheus (or auto mode)
  try {
    const res = await window.kuberneter.queryPodMetricsRange({
      ...promConfig,
      namespace,
      podName: podNamesRegex,
      timeRange
    });

    if (!res.error && res.timeLabels.length > 0) return res;
  } catch {
    // Fall back to metrics-server below
  }

  if (source === 'auto') {
    try {
      const topRes = await window.kuberneter.getTopPods(
        promConfig.kubeconfigPath,
        promConfig.contextName,
        namespace
      );
      if (topRes && topRes.items) {
        const podSet = new Set(podNames);
        const matchedItems = topRes.items.filter((p: { name: string; namespace: string }) =>
          podSet.has(p.name)
        );

        if (matchedItems.length > 0) {
          const nowStr = new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          });

          let totalCpuVal = 0;
          let totalMemVal = 0;

          for (const item of matchedItems) {
            let cpuVal = 0;
            if (item.cpu.endsWith('m')) {
              cpuVal = (parseFloat(item.cpu.slice(0, -1)) || 0) / 1000;
            } else if (item.cpu.endsWith('n')) {
              cpuVal = (parseFloat(item.cpu.slice(0, -1)) || 0) / 1e9;
            } else {
              cpuVal = parseFloat(item.cpu) || 0;
            }

            let memVal = 0;
            if (item.memory.endsWith('Mi')) {
              memVal = parseFloat(item.memory.slice(0, -2)) || 0;
            } else if (item.memory.endsWith('Gi')) {
              memVal = (parseFloat(item.memory.slice(0, -2)) || 0) * 1024;
            } else if (item.memory.endsWith('Ki')) {
              memVal = (parseFloat(item.memory.slice(0, -2)) || 0) / 1024;
            } else {
              memVal = parseFloat(item.memory) || 0;
            }

            totalCpuVal += cpuVal;
            totalMemVal += memVal;
          }

          const groupKey = [...podNames].sort().join(',');
          const cacheKey = `${promConfig.contextName ?? 'default'}:${namespace}:multi:${groupKey}`;
          let buffer = liveMetricsBuffer.get(cacheKey);
          if (!buffer) {
            buffer = { timeLabels: [], cpuUsage: [], memUsage: [] };
            liveMetricsBuffer.set(cacheKey, buffer);
          }

          buffer.timeLabels.push(nowStr);
          buffer.cpuUsage.push(totalCpuVal);
          buffer.memUsage.push(totalMemVal);

          if (buffer.timeLabels.length > MAX_LIVE_SAMPLES) {
            buffer.timeLabels.shift();
            buffer.cpuUsage.shift();
            buffer.memUsage.shift();
          }

          return {
            source: `kube-system / metrics-server (aggregated across ${matchedItems.length} pods)`,
            timeLabels: [...buffer.timeLabels],
            cpu: { usage: [...buffer.cpuUsage], requests: [], limits: [] },
            memory: { usage: [...buffer.memUsage], requests: [], limits: [] },
            network: { rx: [], tx: [] },
            filesystem: { usage: [], limit: [] }
          };
        }
      }
    } catch {
      // Return EMPTY_RANGE
    }
  }

  return EMPTY_RANGE;
}

export function useMultiPodMetricsRange(
  namespace: string,
  podNames: string[],
  timeRange: '1h' | '6h' | '24h',
  enabled: boolean
) {
  const { cluster, configPath, metricsConfig, promConfig, metricsConfigKey } = useMetricsContext();

  const isLiveMetricsServer =
    metricsConfig.source === 'metrics-server' || metricsConfig.source === 'auto';
  const refreshIntervalSec = metricsConfig.refreshInterval ?? 3;
  const refetchInterval =
    refreshIntervalSec > 0 && isLiveMetricsServer ? refreshIntervalSec * 1000 : false;
  const staleTime =
    refreshIntervalSec > 0 && isLiveMetricsServer
      ? Math.min(1_500, Math.floor((refreshIntervalSec * 1000) / 2))
      : isLiveMetricsServer
        ? 1_500
        : 60_000;

  const podKey = [...podNames].sort().join(',');

  return useQuery({
    queryKey: metricsKeys.range(
      configPath ?? 'default',
      cluster,
      namespace,
      `multi:${podKey}`,
      timeRange,
      metricsConfigKey
    ),
    queryFn: () =>
      fetchMultiPodMetricsRange(metricsConfig.source, promConfig, namespace, podNames, timeRange),
    enabled: enabled && !!cluster && !!namespace && podNames.length > 0,
    staleTime,
    refetchInterval,
    gcTime: 120_000
  });
}

async function fetchNodeMetricsRange(
  source: string,
  promConfig: {
    kubeconfigPath: string | undefined;
    contextName: string | undefined;
    provider: string;
    filterEmptyContainers: boolean;
    useHttps: boolean;
    pathPrefix: string;
  },
  nodeName: string,
  timeRange: '1h' | '6h' | '24h'
): Promise<NodeMetricsRange> {
  if (source === 'none') return EMPTY_RANGE;

  if (source === 'metrics-server') {
    try {
      const topRes = await window.kuberneter.getTopNodes(
        promConfig.kubeconfigPath,
        promConfig.contextName
      );
      if (topRes && topRes.items) {
        const nodeItem = topRes.items.find((n: { name: string }) => n.name === nodeName);
        if (nodeItem) {
          const nowStr = new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          });
          let cpuVal = 0;
          if (nodeItem.cpu.endsWith('m')) {
            cpuVal = (parseFloat(nodeItem.cpu.slice(0, -1)) || 0) / 1000;
          } else if (nodeItem.cpu.endsWith('n')) {
            cpuVal = (parseFloat(nodeItem.cpu.slice(0, -1)) || 0) / 1e9;
          } else {
            cpuVal = parseFloat(nodeItem.cpu) || 0;
          }

          let memVal = 0;
          if (nodeItem.memory.endsWith('Mi')) {
            memVal = parseFloat(nodeItem.memory.slice(0, -2)) || 0;
          } else if (nodeItem.memory.endsWith('Gi')) {
            memVal = (parseFloat(nodeItem.memory.slice(0, -2)) || 0) * 1024;
          } else if (nodeItem.memory.endsWith('Ki')) {
            memVal = (parseFloat(nodeItem.memory.slice(0, -2)) || 0) / 1024;
          } else {
            memVal = parseFloat(nodeItem.memory) || 0;
          }

          const cacheKey = `node:${promConfig.contextName ?? 'default'}:${nodeName}`;
          let buffer = liveMetricsBuffer.get(cacheKey);
          if (!buffer) {
            buffer = { timeLabels: [], cpuUsage: [], memUsage: [] };
            liveMetricsBuffer.set(cacheKey, buffer);
          }

          buffer.timeLabels.push(nowStr);
          buffer.cpuUsage.push(cpuVal);
          buffer.memUsage.push(memVal);

          if (buffer.timeLabels.length > MAX_LIVE_SAMPLES) {
            buffer.timeLabels.shift();
            buffer.cpuUsage.shift();
            buffer.memUsage.shift();
          }

          return {
            source: 'kube-system / metrics-server (apis/metrics.k8s.io/v1beta1 — live 3s stream)',
            timeLabels: [...buffer.timeLabels],
            cpu: { usage: [...buffer.cpuUsage], requests: [], limits: [] },
            memory: { usage: [...buffer.memUsage], requests: [], limits: [] },
            network: { rx: [], tx: [] },
            filesystem: { usage: [], limit: [] }
          };
        }
      }
    } catch {
      // Fall through
    }
    return EMPTY_RANGE;
  }

  try {
    const res = await window.kuberneter.queryNodeMetricsRange({
      ...promConfig,
      nodeName,
      timeRange
    });

    if (!res.error && res.timeLabels.length > 0) return res;
  } catch {
    // Fall back to metrics-server if auto
  }

  if (source === 'auto') {
    try {
      const topRes = await window.kuberneter.getTopNodes(
        promConfig.kubeconfigPath,
        promConfig.contextName
      );
      if (topRes && topRes.items) {
        const nodeItem = topRes.items.find((n: { name: string }) => n.name === nodeName);
        if (nodeItem) {
          const nowStr = new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          });
          let cpuVal = 0;
          if (nodeItem.cpu.endsWith('m')) {
            cpuVal = (parseFloat(nodeItem.cpu.slice(0, -1)) || 0) / 1000;
          } else if (nodeItem.cpu.endsWith('n')) {
            cpuVal = (parseFloat(nodeItem.cpu.slice(0, -1)) || 0) / 1e9;
          } else {
            cpuVal = parseFloat(nodeItem.cpu) || 0;
          }

          let memVal = 0;
          if (nodeItem.memory.endsWith('Mi')) {
            memVal = parseFloat(nodeItem.memory.slice(0, -2)) || 0;
          } else if (nodeItem.memory.endsWith('Gi')) {
            memVal = (parseFloat(nodeItem.memory.slice(0, -2)) || 0) * 1024;
          } else if (nodeItem.memory.endsWith('Ki')) {
            memVal = (parseFloat(nodeItem.memory.slice(0, -2)) || 0) / 1024;
          } else {
            memVal = parseFloat(nodeItem.memory) || 0;
          }

          const cacheKey = `node:${promConfig.contextName ?? 'default'}:${nodeName}`;
          let buffer = liveMetricsBuffer.get(cacheKey);
          if (!buffer) {
            buffer = { timeLabels: [], cpuUsage: [], memUsage: [] };
            liveMetricsBuffer.set(cacheKey, buffer);
          }

          buffer.timeLabels.push(nowStr);
          buffer.cpuUsage.push(cpuVal);
          buffer.memUsage.push(memVal);

          if (buffer.timeLabels.length > MAX_LIVE_SAMPLES) {
            buffer.timeLabels.shift();
            buffer.cpuUsage.shift();
            buffer.memUsage.shift();
          }

          return {
            source: 'kube-system / metrics-server (apis/metrics.k8s.io/v1beta1 — live 3s stream)',
            timeLabels: [...buffer.timeLabels],
            cpu: { usage: [...buffer.cpuUsage], requests: [], limits: [] },
            memory: { usage: [...buffer.memUsage], requests: [], limits: [] },
            network: { rx: [], tx: [] },
            filesystem: { usage: [], limit: [] }
          };
        }
      }
    } catch {
      // Fall through
    }
  }

  return EMPTY_RANGE;
}

export function useNodeMetricsRange(
  nodeName: string,
  timeRange: '1h' | '6h' | '24h',
  enabled: boolean
) {
  const { cluster, configPath, metricsConfig, promConfig, metricsConfigKey } = useMetricsContext();

  const isLiveMetricsServer =
    metricsConfig.source === 'metrics-server' || metricsConfig.source === 'auto';
  const refreshIntervalSec = metricsConfig.refreshInterval ?? 3;
  const refetchInterval =
    refreshIntervalSec > 0 && isLiveMetricsServer ? refreshIntervalSec * 1000 : false;
  const staleTime =
    refreshIntervalSec > 0 && isLiveMetricsServer
      ? Math.min(1_500, Math.floor((refreshIntervalSec * 1000) / 2))
      : isLiveMetricsServer
        ? 1_500
        : 60_000;

  return useQuery({
    queryKey: metricsKeys.range(
      configPath ?? 'default',
      cluster,
      'node',
      nodeName,
      timeRange,
      metricsConfigKey
    ),
    queryFn: () => fetchNodeMetricsRange(metricsConfig.source, promConfig, nodeName, timeRange),
    enabled: enabled && !!cluster && !!nodeName,
    staleTime,
    refetchInterval,
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
