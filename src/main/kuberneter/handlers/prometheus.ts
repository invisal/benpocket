import { ipcMain } from 'electron';
import * as net from 'net';
import * as http from 'http';
import * as https from 'https';
import { spawn, type ChildProcess } from 'child_process';
import { resolveKubectlBinaryPath } from './kubectl-settings';

// ─── Types ───────────────────────────────────────────────────────────────────

interface DiscoveredPromService {
  namespace: string;
  name: string;
  port: number;
}

export interface PrometheusQueryConfig {
  kubeconfigPath?: string;
  contextName?: string;
  provider?: string;
  filterEmptyContainers?: boolean;
  useHttps?: boolean;
  pathPrefix?: string;
  kubectlPath?: string;
}

// ─── Provider Presets ────────────────────────────────────────────────────────

const PROVIDER_PRESETS: Record<string, DiscoveredPromService> = {
  lens: { namespace: 'lens-metrics', name: 'prometheus', port: 80 },
  'prometheus-operator': { namespace: 'monitoring', name: 'prometheus-k8s', port: 9090 },
  helm: { namespace: 'monitoring', name: 'prometheus-server', port: 80 },
  'helm-14': {
    namespace: 'monitoring',
    name: 'prometheus-stack-kube-prom-prometheus',
    port: 9090
  },
  stacklight: { namespace: 'stacklight', name: 'prometheus', port: 9090 }
};

// Scan order for auto-detecting Prometheus services across namespaces
const AUTO_DETECT_PRIORITY: DiscoveredPromService[] = [
  PROVIDER_PRESETS['lens'],
  PROVIDER_PRESETS['prometheus-operator'],
  PROVIDER_PRESETS['helm-14'],
  PROVIDER_PRESETS['helm'],
  PROVIDER_PRESETS['stacklight'],
  { namespace: 'prometheus', name: 'prometheus', port: 9090 },
  { namespace: 'kube-system', name: 'prometheus', port: 9090 }
];

// Cache auto-detected Prometheus endpoint per cluster context
const discoveredPromCache = new Map<string, DiscoveredPromService>();

// ─── Network & Subprocess Helpers ────────────────────────────────────────────

function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      const port = addr && typeof addr === 'object' ? addr.port : 0;
      srv.close((err) => {
        if (err) reject(err);
        else resolve(port);
      });
    });
    srv.on('error', reject);
  });
}

function waitForPortForward(child: ChildProcess, timeoutMs = 8000): Promise<void> {
  return new Promise((resolve, reject) => {
    let outputLog = '';

    const timer = setTimeout(() => {
      reject(
        new Error(
          `port-forward timed out waiting for ready signal. Output: ${outputLog.trim() || 'none'}`
        )
      );
    }, timeoutMs);

    const onError = (err: Error) => {
      clearTimeout(timer);
      reject(
        new Error(`KUBECTL_NOT_FOUND: Failed to execute kubectl port-forward (${err.message})`)
      );
    };

    child.on('error', onError);

    const onData = (chunk: Buffer) => {
      const text = chunk.toString();
      outputLog += text;
      if (text.includes('Forwarding from')) {
        clearTimeout(timer);
        child.stdout?.off('data', onData);
        child.off('error', onError);
        // Socket binding settling delay
        setTimeout(resolve, 150);
      }
    };

    child.stdout?.on('data', onData);
    child.stderr?.on('data', (chunk) => {
      outputLog += chunk.toString();
    });

    child.on('exit', (code) => {
      clearTimeout(timer);
      child.off('error', onError);
      reject(new Error(outputLog.trim() || `port-forward exited early with code ${code}`));
    });
  });
}

function buildKubectlFlags(
  kubeconfigPath?: string,
  contextName?: string
): { flags: string[]; env: NodeJS.ProcessEnv } {
  const flags: string[] = [];
  const env: NodeJS.ProcessEnv = { ...process.env };
  if (contextName) {
    flags.push('--context', contextName);
  }
  if (kubeconfigPath && kubeconfigPath !== 'default') {
    env.KUBECONFIG = kubeconfigPath;
    flags.push('--kubeconfig', kubeconfigPath);
  }
  return { flags, env };
}

function findPromPort(
  ports: Array<{ name?: string; port?: number }> | undefined,
  defaultPort: number
): number {
  if (!ports || ports.length === 0) return defaultPort;
  if (ports.length === 1 && ports[0].port) return ports[0].port;

  const named = ports.find((p) => {
    const n = (p.name || '').toLowerCase();
    return n.includes('prom') || n.includes('web') || n.includes('http') || n.includes('api');
  });
  if (named?.port) return named.port;

  const std = ports.find((p) => p.port === 9090 || p.port === 80 || p.port === 9091);
  if (std?.port) return std.port;

  return ports[0].port || defaultPort;
}

// ─── Prometheus Service Discovery ────────────────────────────────────────────

async function resolvePrometheusService(
  kubeconfigPath: string | undefined,
  contextName: string | undefined,
  provider = 'auto',
  kubectlPath?: string
): Promise<DiscoveredPromService> {
  if (provider !== 'auto' && PROVIDER_PRESETS[provider]) {
    return PROVIDER_PRESETS[provider];
  }

  const cacheKey = `${kubeconfigPath ?? 'default'}:${contextName ?? 'default'}`;
  const cached = discoveredPromCache.get(cacheKey);
  if (cached) return cached;

  const { flags, env } = buildKubectlFlags(kubeconfigPath, contextName);
  const kubectlBin = await resolveKubectlBinaryPath(kubectlPath);

  return new Promise((resolve) => {
    const args = ['get', 'svc', '-A', '-o', 'json', ...flags];
    const proc = spawn(kubectlBin, args, { shell: false, env });

    let stdout = '';
    proc.stdout?.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    proc.on('close', (code) => {
      if (code === 0 && stdout) {
        try {
          const json = JSON.parse(stdout);
          const items = (json.items || []) as Array<{
            metadata?: { name?: string; namespace?: string; labels?: Record<string, string> };
            spec?: { ports?: Array<{ name?: string; port?: number }> };
          }>;

          for (const def of AUTO_DETECT_PRIORITY) {
            const match = items.find(
              (item) =>
                item.metadata?.namespace === def.namespace && item.metadata?.name === def.name
            );
            if (match) {
              const targetPort = findPromPort(match.spec?.ports, def.port);
              const result = { namespace: def.namespace, name: def.name, port: targetPort };
              discoveredPromCache.set(cacheKey, result);
              return resolve(result);
            }
          }

          for (const item of items) {
            const name = item.metadata?.name ?? '';
            const ns = item.metadata?.namespace ?? 'default';
            const labels = item.metadata?.labels ?? {};
            const isProm =
              name.includes('prometheus') ||
              labels['app'] === 'prometheus' ||
              labels['app.kubernetes.io/name'] === 'prometheus' ||
              labels['app.kubernetes.io/instance']?.includes('prometheus');

            if (isProm) {
              const targetPort = findPromPort(item.spec?.ports, 9090);
              const result = { namespace: ns, name, port: targetPort };
              discoveredPromCache.set(cacheKey, result);
              return resolve(result);
            }
          }
        } catch {
          // JSON parse error — fall through
        }
      }

      resolve(AUTO_DETECT_PRIORITY[0]);
    });

    proc.on('error', () => resolve(AUTO_DETECT_PRIORITY[0]));
  });
}

async function openPortForward(
  svc: DiscoveredPromService,
  kubeconfigPath?: string,
  contextName?: string,
  kubectlPath?: string
): Promise<{ localPort: number; proc: ChildProcess }> {
  const localPort = await getFreePort();
  const { flags, env } = buildKubectlFlags(kubeconfigPath, contextName);
  const args = [
    'port-forward',
    '--address',
    '127.0.0.1',
    `svc/${svc.name}`,
    `${localPort}:${svc.port}`,
    '-n',
    svc.namespace,
    ...flags
  ];
  const kubectlBin = await resolveKubectlBinaryPath(kubectlPath);
  const proc = spawn(kubectlBin, args, { shell: false, env });
  await waitForPortForward(proc);
  return { localPort, proc };
}

function buildPromBaseUrl(localPort: number, useHttps: boolean, pathPrefix: string): string {
  const scheme = useHttps ? 'https' : 'http';
  const prefix = pathPrefix.startsWith('/') ? pathPrefix : pathPrefix ? `/${pathPrefix}` : '';
  return `${scheme}://127.0.0.1:${localPort}${prefix}`;
}

function containerFilter(filterEmpty: boolean): string {
  return filterEmpty ? ',container!="",container!="POD"' : '';
}

// ─── Native HTTP/HTTPS Client & Query Execution ─────────────────────────────

function httpGetJson<T = unknown>(urlStr: string, timeoutMs = 10000): Promise<T> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(urlStr);
    const isHttps = urlObj.protocol === 'https:';
    const client = isHttps ? https : http;

    const options: http.RequestOptions = {
      timeout: timeoutMs,
      headers: { Accept: 'application/json' },
      ...(isHttps ? { rejectUnauthorized: false } : {})
    };

    const req = client.get(urlStr, options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(body) as T);
          } catch (e) {
            reject(new Error(`Failed to parse Prometheus JSON response: ${String(e)}`));
          }
        } else {
          reject(
            new Error(
              `Prometheus HTTP ${res.statusCode} ${res.statusMessage || ''}: ${body.slice(0, 200)}`
            )
          );
        }
      });
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Request to Prometheus timed out after ${timeoutMs}ms`));
    });

    req.on('error', (err) => {
      reject(
        new Error(
          `Connection error to Prometheus (${urlObj.hostname}:${urlObj.port}): ${err.message}`
        )
      );
    });

    req.end();
  });
}

async function queryPromQL(
  baseUrl: string,
  promql: string,
  retries = 3
): Promise<{ metric: Record<string, string>; value: [number, string] }[]> {
  let currentBaseUrl = baseUrl;
  let lastError: unknown = null;

  for (let attempt = 0; attempt < retries; attempt++) {
    const url = `${currentBaseUrl}/api/v1/query?query=${encodeURIComponent(promql)}`;
    try {
      const json = await httpGetJson<{
        status: string;
        data: { result: { metric: Record<string, string>; value: [number, string] }[] };
      }>(url, 10000);
      if (json.status !== 'success') throw new Error(`Prometheus status: ${json.status}`);
      return json.data?.result || [];
    } catch (err) {
      lastError = err;
      const errMsg = err instanceof Error ? err.message : String(err);

      if (
        currentBaseUrl.startsWith('https://') &&
        (errMsg.includes('WRONG_VERSION_NUMBER') || errMsg.includes('EPROTO'))
      ) {
        currentBaseUrl = currentBaseUrl.replace('https://', 'http://');
        continue;
      }

      if (attempt < retries - 1) {
        await new Promise((resolve) => setTimeout(resolve, 300 * (attempt + 1)));
      }
    }
  }

  const msg = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(msg);
}

async function queryPromQLRange(
  baseUrl: string,
  promql: string,
  startUnix: number,
  endUnix: number,
  stepSeconds: number
): Promise<Array<[number, string]>> {
  let currentBaseUrl = baseUrl;
  const getUrl = (bUrl: string) =>
    `${bUrl}/api/v1/query_range` +
    `?query=${encodeURIComponent(promql)}` +
    `&start=${startUnix}&end=${endUnix}&step=${stepSeconds}`;

  const parseResult = (json: {
    status: string;
    data?: { result?: Array<{ values?: Array<[number, string]> }> };
  }) => {
    if (json.status !== 'success') throw new Error(`Prometheus range query status: ${json.status}`);
    if (!json.data?.result || json.data.result.length === 0) return [];
    for (const item of json.data.result) {
      if (item.values && item.values.length > 0) {
        return item.values;
      }
    }
    return [];
  };

  try {
    const json = await httpGetJson<{
      status: string;
      data: { result: Array<{ values: Array<[number, string]> }> };
    }>(getUrl(currentBaseUrl), 10000);

    return parseResult(json);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    if (
      currentBaseUrl.startsWith('https://') &&
      (errMsg.includes('WRONG_VERSION_NUMBER') || errMsg.includes('EPROTO'))
    ) {
      currentBaseUrl = currentBaseUrl.replace('https://', 'http://');
      const json = await httpGetJson<{
        status: string;
        data: { result: Array<{ values: Array<[number, string]> }> };
      }>(getUrl(currentBaseUrl), 10000);
      return parseResult(json);
    }
    throw err;
  }
}

async function fetchRangeWithFallback(
  baseUrl: string,
  queries: string[],
  startUnix: number,
  endUnix: number,
  stepSec: number
): Promise<Array<[number, string]>> {
  for (const q of queries) {
    try {
      const res = await queryPromQLRange(baseUrl, q, startUnix, endUnix, stepSec);
      if (res && res.length > 0) return res;
    } catch {
      // Try next PromQL query candidate
    }
  }
  return [];
}

// ─── IPC Handlers Registration ───────────────────────────────────────────────

export function registerPrometheusHandlers(): void {
  const handleOverviewMetrics = async (
    _: unknown,
    params: {
      kubeconfigPath?: string;
      contextName?: string;
      provider?: string;
      filterEmptyContainers?: boolean;
      useHttps?: boolean;
      pathPrefix?: string;
      kubectlPath?: string;
    }
  ) => {
    const {
      kubeconfigPath,
      contextName,
      provider = 'auto',
      filterEmptyContainers = false,
      useHttps = false,
      pathPrefix = '',
      kubectlPath
    } = params;

    let portForwardProc: ChildProcess | null = null;

    try {
      const svc = await resolvePrometheusService(
        kubeconfigPath,
        contextName,
        provider,
        kubectlPath
      );
      const { localPort, proc } = await openPortForward(
        svc,
        kubeconfigPath,
        contextName,
        kubectlPath
      );
      portForwardProc = proc;

      const baseUrl = buildPromBaseUrl(localPort, useHttps, pathPrefix);
      const cf = containerFilter(filterEmptyContainers);

      const cpuQuery = `sum(node_namespace_pod_container:container_cpu_usage_seconds_total:sum_irate{${cf}})`;
      const memoryQuery = `sum(container_memory_working_set_bytes{${cf}})`;
      const podsQuery = `count(count by (pod) (container_memory_working_set_bytes{${cf}}))`;

      const [cpuRes, memRes, podRes] = await Promise.allSettled([
        queryPromQL(baseUrl, cpuQuery),
        queryPromQL(baseUrl, memoryQuery),
        queryPromQL(baseUrl, podsQuery)
      ]);

      const parseVal = (res: PromiseSettledResult<{ value: [number, string] }[]>) => {
        if (res.status === 'fulfilled' && res.value[0]?.value?.[1]) {
          return parseFloat(res.value[0].value[1]) || 0;
        }
        return null;
      };

      return {
        source: `${svc.namespace} / ${svc.name}:${svc.port}`,
        cpuUsage: parseVal(cpuRes),
        memoryWorkingSet: parseVal(memRes),
        podCount: parseVal(podRes) ? Math.round(parseVal(podRes)!) : null
      };
    } catch (err) {
      return {
        error: err instanceof Error ? err.message : String(err),
        cpuUsage: null,
        memoryWorkingSet: null,
        podCount: null
      };
    } finally {
      if (portForwardProc && !portForwardProc.killed) portForwardProc.kill('SIGTERM');
    }
  };

  // Register under both channel names
  ipcMain.handle('kuberneter:query-prometheus', handleOverviewMetrics);
  ipcMain.handle('kuberneter:get-prometheus-metrics', handleOverviewMetrics);

  const handlePodInstantMetrics = async (_: unknown, params: PrometheusQueryConfig) => {
    const {
      kubeconfigPath,
      contextName,
      provider = 'auto',
      filterEmptyContainers = false,
      useHttps = false,
      pathPrefix = '',
      kubectlPath
    } = params;

    let portForwardProc: ChildProcess | null = null;

    try {
      const svc = await resolvePrometheusService(
        kubeconfigPath,
        contextName,
        provider,
        kubectlPath
      );
      const { localPort, proc } = await openPortForward(
        svc,
        kubeconfigPath,
        contextName,
        kubectlPath
      );
      portForwardProc = proc;

      const baseUrl = buildPromBaseUrl(localPort, useHttps, pathPrefix);
      const cf = containerFilter(filterEmptyContainers);

      const cpuQueries = [
        `sum(node_namespace_pod_container:container_cpu_usage_seconds_total:sum_irate{${cf}}) by (namespace, pod)`,
        `sum(rate(container_cpu_usage_seconds_total{${cf}}[5m])) by (namespace, pod)`,
        `sum(rate(container_cpu_usage_seconds_total{${cf}}[2m])) by (namespace, pod)`,
        `sum(rate(container_cpu_usage_seconds_total[5m])) by (namespace, pod)`
      ];

      const memQueries = [
        `sum(node_namespace_pod_container:container_memory_working_set_bytes) by (namespace, pod)`,
        `sum(container_memory_working_set_bytes{container!="",container!="POD"}) by (namespace, pod)`,
        `sum(container_memory_working_set_bytes{${cf}}) by (namespace, pod)`
      ];

      let cpuResults: { metric: Record<string, string>; value: [number, string] }[] = [];
      for (const q of cpuQueries) {
        try {
          const res = await queryPromQL(baseUrl, q);
          if (res && res.length > 0) {
            cpuResults = res;
            break;
          }
        } catch {
          // try next
        }
      }

      let memResults: { metric: Record<string, string>; value: [number, string] }[] = [];
      for (const q of memQueries) {
        try {
          const res = await queryPromQL(baseUrl, q);
          if (res && res.length > 0) {
            memResults = res;
            break;
          }
        } catch {
          // try next
        }
      }

      const podMetricsMap = new Map<string, { cpu?: string; memory?: string }>();

      for (const r of cpuResults) {
        const ns = r.metric.namespace || r.metric.pod_namespace || 'default';
        const pod = r.metric.pod || r.metric.pod_name || '';
        if (!pod) continue;
        const key = `${ns}:${pod}`;
        const cpuCores = parseFloat(r.value[1]) || 0;
        const cpuStr = `${Math.round(cpuCores * 1000)}m`;
        podMetricsMap.set(key, { ...podMetricsMap.get(key), cpu: cpuStr });
      }

      for (const r of memResults) {
        const ns = r.metric.namespace || r.metric.pod_namespace || 'default';
        const pod = r.metric.pod || r.metric.pod_name || '';
        if (!pod) continue;
        const key = `${ns}:${pod}`;
        const memBytes = parseFloat(r.value[1]) || 0;
        const memMiB = (memBytes / (1024 * 1024)).toFixed(1);
        const memStr = `${memMiB}Mi`;
        const existing = podMetricsMap.get(key) || {};
        podMetricsMap.set(key, { ...existing, memory: memStr });
      }

      const items: Array<{ name: string; namespace: string; cpu: string; memory: string }> = [];
      for (const [key, val] of podMetricsMap.entries()) {
        const [ns, pod] = key.split(':');
        items.push({
          name: pod,
          namespace: ns,
          cpu: val.cpu || '0m',
          memory: val.memory || '0Mi'
        });
      }

      return { items };
    } catch (err) {
      return {
        items: [],
        error: err instanceof Error ? err.message : String(err)
      };
    } finally {
      if (portForwardProc && !portForwardProc.killed) portForwardProc.kill('SIGTERM');
    }
  };

  ipcMain.handle('kuberneter:query-prometheus-instant-pods', handlePodInstantMetrics);

  const handlePodMetrics = async (
    _: unknown,
    params: {
      kubeconfigPath?: string;
      contextName?: string;
      namespace: string;
      podName: string;
      timeRange?: '1h' | '6h' | '24h';
      provider?: string;
      useHttps?: boolean;
      pathPrefix?: string;
      kubectlPath?: string;
    }
  ) => {
    const {
      kubeconfigPath,
      contextName,
      namespace,
      podName,
      timeRange = '1h',
      provider = 'auto',
      useHttps = false,
      pathPrefix = '',
      kubectlPath
    } = params;

    let portForwardProc: ChildProcess | null = null;

    try {
      const svc = await resolvePrometheusService(
        kubeconfigPath,
        contextName,
        provider,
        kubectlPath
      );
      const { localPort, proc } = await openPortForward(
        svc,
        kubeconfigPath,
        contextName,
        kubectlPath
      );
      portForwardProc = proc;

      const baseUrl = buildPromBaseUrl(localPort, useHttps, pathPrefix);

      const now = Math.floor(Date.now() / 1000);
      const rangeSeconds = timeRange === '24h' ? 86400 : timeRange === '6h' ? 21600 : 3600;
      const stepSec = Math.max(15, Math.floor(rangeSeconds / 60));
      const startUnix = now - rangeSeconds;
      const endUnix = now;

      const [
        rawCpuUsage,
        rawCpuReq,
        rawCpuLim,
        rawMemUsage,
        rawMemReq,
        rawMemLim,
        rawNetRx,
        rawNetTx,
        rawFsUsage,
        rawFsLimit
      ] = await Promise.all([
        fetchRangeWithFallback(
          baseUrl,
          [
            `node_namespace_pod_container:container_cpu_usage_seconds_total:sum_irate{namespace="${namespace}",pod="${podName}"}`,
            `sum(node_namespace_pod_container:container_cpu_usage_seconds_total:sum_irate{namespace="${namespace}",pod="${podName}"})`,
            `sum(rate(container_cpu_usage_seconds_total{namespace="${namespace}",pod="${podName}",container!="",container!="POD"}[5m]))`,
            `sum(rate(container_cpu_usage_seconds_total{namespace="${namespace}",pod="${podName}"}[5m]))`,
            `sum(rate(container_cpu_usage_seconds_total{namespace="${namespace}",pod_name="${podName}"}[5m]))`,
            `sum(rate(container_cpu_usage_seconds_total{pod="${podName}"}[5m]))`,
            `sum(rate(container_cpu_usage_seconds_total{namespace="${namespace}",pod=~"^${podName}.*"}[5m]))`,
            `sum(rate(container_cpu_usage_seconds_total{namespace="${namespace}",pod="${podName}"}[2m]))`
          ],
          startUnix,
          endUnix,
          stepSec
        ),
        fetchRangeWithFallback(
          baseUrl,
          [
            `sum(kube_pod_container_resource_requests{namespace="${namespace}",pod="${podName}",resource="cpu"})`,
            `sum(kube_pod_container_resource_requests{namespace="${namespace}",pod_name="${podName}",resource="cpu"})`
          ],
          startUnix,
          endUnix,
          stepSec
        ),
        fetchRangeWithFallback(
          baseUrl,
          [
            `sum(kube_pod_container_resource_limits{namespace="${namespace}",pod="${podName}",resource="cpu"})`,
            `sum(kube_pod_container_resource_limits{namespace="${namespace}",pod_name="${podName}",resource="cpu"})`
          ],
          startUnix,
          endUnix,
          stepSec
        ),
        fetchRangeWithFallback(
          baseUrl,
          [
            `node_namespace_pod_container:container_memory_working_set_bytes{namespace="${namespace}",pod="${podName}"}`,
            `sum(node_namespace_pod_container:container_memory_working_set_bytes{namespace="${namespace}",pod="${podName}"})`,
            `sum(container_memory_working_set_bytes{namespace="${namespace}",pod="${podName}",container!="",container!="POD"})`,
            `sum(container_memory_working_set_bytes{namespace="${namespace}",pod_name="${podName}",container!="",container!="POD"})`,
            `sum(container_memory_working_set_bytes{namespace="${namespace}",pod=~"^${podName}.*",container!="",container!="POD"})`
          ],
          startUnix,
          endUnix,
          stepSec
        ),
        fetchRangeWithFallback(
          baseUrl,
          [
            `sum(kube_pod_container_resource_requests{namespace="${namespace}",pod="${podName}",resource="memory"})`,
            `sum(kube_pod_container_resource_requests{namespace="${namespace}",pod_name="${podName}",resource="memory"})`
          ],
          startUnix,
          endUnix,
          stepSec
        ),
        fetchRangeWithFallback(
          baseUrl,
          [
            `sum(kube_pod_container_resource_limits{namespace="${namespace}",pod="${podName}",resource="memory"})`,
            `sum(kube_pod_container_resource_limits{namespace="${namespace}",pod_name="${podName}",resource="memory"})`
          ],
          startUnix,
          endUnix,
          stepSec
        ),
        fetchRangeWithFallback(
          baseUrl,
          [
            `sum(rate(container_network_receive_bytes_total{namespace="${namespace}",pod="${podName}"}[2m]))`,
            `sum(rate(container_network_receive_bytes_total{namespace="${namespace}",pod_name="${podName}"}[2m]))`,
            `sum(rate(container_network_receive_bytes_total{namespace="${namespace}",pod=~"^${podName}.*"}[2m]))`
          ],
          startUnix,
          endUnix,
          stepSec
        ),
        fetchRangeWithFallback(
          baseUrl,
          [
            `sum(rate(container_network_transmit_bytes_total{namespace="${namespace}",pod="${podName}"}[2m]))`,
            `sum(rate(container_network_transmit_bytes_total{namespace="${namespace}",pod_name="${podName}"}[2m]))`,
            `sum(rate(container_network_transmit_bytes_total{namespace="${namespace}",pod=~"^${podName}.*"}[2m]))`
          ],
          startUnix,
          endUnix,
          stepSec
        ),
        fetchRangeWithFallback(
          baseUrl,
          [
            `sum(container_fs_usage_bytes{namespace="${namespace}",pod="${podName}"})`,
            `sum(container_fs_usage_bytes{namespace="${namespace}",pod_name="${podName}"})`,
            `sum(container_fs_usage_bytes{namespace="${namespace}",pod=~"^${podName}.*"})`
          ],
          startUnix,
          endUnix,
          stepSec
        ),
        fetchRangeWithFallback(
          baseUrl,
          [
            `sum(container_fs_limit_bytes{namespace="${namespace}",pod="${podName}"})`,
            `sum(container_fs_limit_bytes{namespace="${namespace}",pod_name="${podName}"})`
          ],
          startUnix,
          endUnix,
          stepSec
        )
      ]);

      if (!rawCpuUsage.length && !rawMemUsage.length && !rawNetRx.length && !rawFsUsage.length) {
        return {
          error: 'No Prometheus metric data available for this pod',
          timeLabels: [],
          cpu: { usage: [], requests: [], limits: [] },
          memory: { usage: [], requests: [], limits: [] },
          network: { rx: [], tx: [] },
          filesystem: { usage: [], limit: [] }
        };
      }

      const timePointsSource =
        rawCpuUsage.length > 0
          ? rawCpuUsage
          : rawMemUsage.length > 0
            ? rawMemUsage
            : rawNetRx.length > 0
              ? rawNetRx
              : rawFsUsage;

      const timeLabels = timePointsSource.map(([ts]) => {
        const d = new Date(ts * 1000);
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const hh = String(d.getHours()).padStart(2, '0');
        const min = String(d.getMinutes()).padStart(2, '0');
        return timeRange === '24h' ? `${mm}/${dd} ${hh}:${min}` : `${hh}:${min}`;
      });

      const toNum = (raw: Array<[number, string]>) => raw.map(([, v]) => parseFloat(v) || 0);
      const toMiB = (raw: Array<[number, string]>) =>
        raw.map(([, v]) => (parseFloat(v) || 0) / (1024 * 1024));
      const toKBs = (raw: Array<[number, string]>) =>
        raw.map(([, v]) => (parseFloat(v) || 0) / 1024);

      return {
        source: `${svc.namespace} / ${svc.name}:${svc.port}`,
        timeLabels,
        cpu: { usage: toNum(rawCpuUsage), requests: toNum(rawCpuReq), limits: toNum(rawCpuLim) },
        memory: {
          usage: toMiB(rawMemUsage),
          requests: toMiB(rawMemReq),
          limits: toMiB(rawMemLim)
        },
        network: { rx: toKBs(rawNetRx), tx: toKBs(rawNetTx) },
        filesystem: { usage: toMiB(rawFsUsage), limit: toMiB(rawFsLimit) }
      };
    } catch (err) {
      return {
        error: err instanceof Error ? err.message : String(err),
        timeLabels: [],
        cpu: { usage: [], requests: [], limits: [] },
        memory: { usage: [], requests: [], limits: [] },
        network: { rx: [], tx: [] },
        filesystem: { usage: [], limit: [] }
      };
    } finally {
      if (portForwardProc && !portForwardProc.killed) portForwardProc.kill('SIGTERM');
    }
  };

  // Register under both channel names
  ipcMain.handle('kuberneter:query-pod-metrics-range', handlePodMetrics);
  ipcMain.handle('kuberneter:get-pod-metrics', handlePodMetrics);

  ipcMain.handle('kuberneter:test-prometheus', async (_, config: PrometheusQueryConfig) => {
    const {
      kubeconfigPath,
      contextName,
      provider = 'auto',
      useHttps = false,
      pathPrefix = ''
    } = config;

    let portForwardProc: ChildProcess | null = null;
    const startMs = Date.now();
    try {
      const svc = await resolvePrometheusService(
        kubeconfigPath,
        contextName,
        provider,
        config.kubectlPath
      );
      const { localPort, proc } = await openPortForward(
        svc,
        kubeconfigPath,
        contextName,
        config.kubectlPath
      );
      portForwardProc = proc;

      const baseUrl = buildPromBaseUrl(localPort, useHttps, pathPrefix);
      await queryPromQL(baseUrl, '1+1');

      return {
        ok: true,
        latencyMs: Date.now() - startMs,
        source: `${svc.namespace} / ${svc.name}:${svc.port}`
      };
    } catch (err) {
      return {
        ok: false,
        latencyMs: Date.now() - startMs,
        error: err instanceof Error ? err.message : String(err)
      };
    } finally {
      if (portForwardProc && !portForwardProc.killed) portForwardProc.kill('SIGTERM');
    }
  });

  ipcMain.handle(
    'kuberneter:clear-prometheus-cache',
    (_, kubeconfigPath?: string, contextName?: string) => {
      const cacheKey = `${kubeconfigPath ?? 'default'}:${contextName ?? 'default'}`;
      discoveredPromCache.delete(cacheKey);
      return { ok: true };
    }
  );
}

export { registerPrometheusHandlers as registerPrometheusHandler };
