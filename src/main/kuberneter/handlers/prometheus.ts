import { ipcMain } from 'electron';
import * as net from 'net';
import { spawn } from 'child_process';
import type { ChildProcess } from 'child_process';

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
}

// ─── Provider lookup table ────────────────────────────────────────────────────

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

// Scan order for auto-detect
const AUTO_DETECT_PRIORITY: DiscoveredPromService[] = [
  PROVIDER_PRESETS['lens'],
  PROVIDER_PRESETS['prometheus-operator'],
  PROVIDER_PRESETS['helm-14'],
  PROVIDER_PRESETS['helm'],
  PROVIDER_PRESETS['stacklight'],
  { namespace: 'prometheus', name: 'prometheus', port: 9090 },
  { namespace: 'kube-system', name: 'prometheus', port: 9090 }
];

// ─── Cache ────────────────────────────────────────────────────────────────────

/** Auto-detected Prometheus endpoint per cluster context */
const discoveredPromCache = new Map<string, DiscoveredPromService>();

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
    const timer = setTimeout(() => {
      reject(new Error('port-forward timed out waiting for ready signal'));
    }, timeoutMs);

    const onData = (chunk: Buffer) => {
      if (chunk.toString().includes('Forwarding from')) {
        clearTimeout(timer);
        child.stdout?.off('data', onData);
        resolve();
      }
    };

    child.stdout?.on('data', onData);
    child.on('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`port-forward exited early with code ${code}`));
    });
  });
}

function buildKubectlArgs(kubeconfigPath?: string, contextName?: string): string[] {
  const args: string[] = [];
  if (kubeconfigPath) args.push('--kubeconfig', kubeconfigPath);
  if (contextName) args.push('--context', contextName);
  return args;
}

/** Resolve which Prometheus service to use based on provider setting */
async function resolvePrometheusService(
  kubeconfigPath: string | undefined,
  contextName: string | undefined,
  provider = 'auto'
): Promise<DiscoveredPromService> {
  // Named provider — go directly without scanning
  if (provider !== 'auto' && PROVIDER_PRESETS[provider]) {
    return PROVIDER_PRESETS[provider];
  }

  // Auto-detect: check cache first
  const cacheKey = `${kubeconfigPath ?? 'default'}:${contextName ?? 'default'}`;
  const cached = discoveredPromCache.get(cacheKey);
  if (cached) return cached;

  return new Promise((resolve) => {
    const args = [
      ...buildKubectlArgs(kubeconfigPath, contextName),
      'get',
      'svc',
      '-A',
      '-o',
      'json'
    ];
    const proc = spawn('kubectl', args, { shell: true });

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
            spec?: { ports?: Array<{ port?: number }> };
          }>;

          // 1. Priority list match
          for (const def of AUTO_DETECT_PRIORITY) {
            const match = items.find(
              (item) =>
                item.metadata?.namespace === def.namespace && item.metadata?.name === def.name
            );
            if (match) {
              const targetPort = match.spec?.ports?.[0]?.port ?? def.port;
              const result = { namespace: def.namespace, name: def.name, port: targetPort };
              discoveredPromCache.set(cacheKey, result);
              return resolve(result);
            }
          }

          // 2. Fuzzy match on name / labels
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
              const targetPort = item.spec?.ports?.[0]?.port ?? 9090;
              const result = { namespace: ns, name, port: targetPort };
              discoveredPromCache.set(cacheKey, result);
              return resolve(result);
            }
          }
        } catch {
          // JSON parse error — fall through to default
        }
      }

      // Last resort fallback
      resolve(AUTO_DETECT_PRIORITY[0]);
    });

    proc.on('error', () => resolve(AUTO_DETECT_PRIORITY[0]));
  });
}

/** Open a kubectl port-forward and return { localPort, proc } */
async function openPortForward(
  svc: DiscoveredPromService,
  kubeconfigPath?: string,
  contextName?: string
): Promise<{ localPort: number; proc: ChildProcess }> {
  const localPort = await getFreePort();
  const args = [
    ...buildKubectlArgs(kubeconfigPath, contextName),
    'port-forward',
    `svc/${svc.name}`,
    `${localPort}:${svc.port}`,
    '-n',
    svc.namespace
  ];
  const proc = spawn('kubectl', args, { shell: true });
  await waitForPortForward(proc);
  return { localPort, proc };
}

/** Build base URL for Prometheus HTTP API */
function buildPromBaseUrl(localPort: number, useHttps: boolean, pathPrefix: string): string {
  const scheme = useHttps ? 'https' : 'http';
  const prefix = pathPrefix.startsWith('/') ? pathPrefix : pathPrefix ? `/${pathPrefix}` : '';
  return `${scheme}://127.0.0.1:${localPort}${prefix}`;
}

/** Container filter fragment for PromQL */
function containerFilter(filterEmpty: boolean): string {
  return filterEmpty ? ',container!="",container!="POD"' : '';
}

/** Prometheus instant query */
async function queryPromQL(
  baseUrl: string,
  promql: string
): Promise<{ metric: Record<string, string>; value: [number, string] }[]> {
  const url = `${baseUrl}/api/v1/query?query=${encodeURIComponent(promql)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`Prometheus HTTP ${res.status}: ${res.statusText}`);
  const json = (await res.json()) as {
    status: string;
    data: { result: { metric: Record<string, string>; value: [number, string] }[] };
  };
  if (json.status !== 'success') throw new Error(`Prometheus returned status: ${json.status}`);
  return json.data.result;
}

/** Prometheus range query */
async function queryPromQLRange(
  baseUrl: string,
  promql: string,
  startUnix: number,
  endUnix: number,
  stepSeconds: number
): Promise<Array<[number, string]>> {
  const url =
    `${baseUrl}/api/v1/query_range` +
    `?query=${encodeURIComponent(promql)}` +
    `&start=${startUnix}&end=${endUnix}&step=${stepSeconds}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) return [];
  const json = (await res.json()) as {
    status: string;
    data: { result: Array<{ metric: Record<string, string>; values: Array<[number, string]> }> };
  };
  if (json.status !== 'success' || !json.data.result?.length) return [];
  return json.data.result[0].values;
}

// ─── IPC Handlers ─────────────────────────────────────────────────────────────

export function registerPrometheusHandler(): void {
  // 1. Instantaneous pod metrics (used in pod list table)
  ipcMain.handle('kuberneter:query-prometheus', async (_, config: PrometheusQueryConfig) => {
    const {
      kubeconfigPath,
      contextName,
      provider = 'auto',
      filterEmptyContainers = true,
      useHttps = false,
      pathPrefix = ''
    } = config;

    let portForwardProc: ChildProcess | null = null;
    try {
      const svc = await resolvePrometheusService(kubeconfigPath, contextName, provider);
      const { localPort, proc } = await openPortForward(svc, kubeconfigPath, contextName);
      portForwardProc = proc;

      const baseUrl = buildPromBaseUrl(localPort, useHttps, pathPrefix);
      const cf = containerFilter(filterEmptyContainers);
      const cpuQuery = `sum(rate(container_cpu_usage_seconds_total{container!=""${cf}}[5m])) by (pod, namespace)`;
      const memQuery = `sum(container_memory_working_set_bytes{container!=""${cf}}) by (pod, namespace)`;

      const [cpuResults, memResults] = await Promise.all([
        queryPromQL(baseUrl, cpuQuery),
        queryPromQL(baseUrl, memQuery)
      ]);

      const cpuMap = new Map<string, string>();
      for (const r of cpuResults) {
        const key = `${r.metric.namespace}/${r.metric.pod}`;
        const cores = parseFloat(r.value[1]);
        cpuMap.set(key, isNaN(cores) ? '0' : cores.toFixed(4));
      }

      const memMap = new Map<string, string>();
      for (const r of memResults) {
        const key = `${r.metric.namespace}/${r.metric.pod}`;
        const bytes = parseFloat(r.value[1]);
        if (!isNaN(bytes)) memMap.set(key, `${(bytes / (1024 * 1024)).toFixed(3)}Mi`);
      }

      const keys = new Set([...cpuMap.keys(), ...memMap.keys()]);
      const items = Array.from(keys).map((key) => {
        const [ns, ...nameParts] = key.split('/');
        return {
          namespace: ns,
          name: nameParts.join('/'),
          cpu: cpuMap.get(key) ?? '0',
          memory: memMap.get(key) ?? '0Mi'
        };
      });

      return { items, source: `${svc.namespace} / ${svc.name}:${svc.port}` };
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err), items: [] };
    } finally {
      if (portForwardProc && !portForwardProc.killed) portForwardProc.kill('SIGTERM');
    }
  });

  // 2. Time-series range metrics for pod detail charts
  ipcMain.handle(
    'kuberneter:query-pod-metrics-range',
    async (
      _,
      params: PrometheusQueryConfig & {
        namespace: string;
        podName: string;
        timeRange?: '1h' | '6h' | '24h';
      }
    ) => {
      const {
        kubeconfigPath,
        contextName,
        namespace,
        podName,
        timeRange = '1h',
        provider = 'auto',
        filterEmptyContainers = true,
        useHttps = false,
        pathPrefix = ''
      } = params;

      let portForwardProc: ChildProcess | null = null;
      try {
        const svc = await resolvePrometheusService(kubeconfigPath, contextName, provider);
        const { localPort, proc } = await openPortForward(svc, kubeconfigPath, contextName);
        portForwardProc = proc;

        const baseUrl = buildPromBaseUrl(localPort, useHttps, pathPrefix);

        const endUnix = Math.floor(Date.now() / 1000);
        const spanSec = timeRange === '24h' ? 86400 : timeRange === '6h' ? 21600 : 3600;
        const startUnix = endUnix - spanSec;
        const stepSec = Math.max(15, Math.floor(spanSec / 10));

        const cf = containerFilter(filterEmptyContainers);
        const sel = `namespace="${namespace}",pod="${podName}"`;

        const queries = {
          cpuUsage: `sum(rate(container_cpu_usage_seconds_total{${sel},container!=""${cf}}[5m]))`,
          cpuReq: `sum(kube_pod_container_resource_requests{${sel},resource="cpu"})`,
          cpuLim: `sum(kube_pod_container_resource_limits{${sel},resource="cpu"})`,
          memUsage: `sum(container_memory_working_set_bytes{${sel},container!=""${cf}})`,
          memReq: `sum(kube_pod_container_resource_requests{${sel},resource="memory"})`,
          memLim: `sum(kube_pod_container_resource_limits{${sel},resource="memory"})`,
          netRx: `sum(rate(container_network_receive_bytes_total{${sel}}[5m]))`,
          netTx: `sum(rate(container_network_transmit_bytes_total{${sel}}[5m]))`,
          fsUsage: `sum(container_fs_usage_bytes{${sel},container!=""${cf}})`,
          fsLimit: `sum(container_fs_limit_hash{${sel}} or container_fs_limit_bytes{${sel}})`
        };

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
        ] = await Promise.all(
          Object.values(queries).map((q) =>
            queryPromQLRange(baseUrl, q, startUnix, endUnix, stepSec)
          )
        );

        if (!rawCpuUsage.length && !rawMemUsage.length) {
          return {
            error: 'No Prometheus metric data available',
            timeLabels: [],
            cpu: { usage: [], requests: [], limits: [] },
            memory: { usage: [], requests: [], limits: [] },
            network: { rx: [], tx: [] },
            filesystem: { usage: [], limit: [] }
          };
        }

        const timeLabels = rawCpuUsage.map(([ts]) => {
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
    }
  );

  // 3. Test Prometheus connectivity
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
      const svc = await resolvePrometheusService(kubeconfigPath, contextName, provider);
      const { localPort, proc } = await openPortForward(svc, kubeconfigPath, contextName);
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

  // 4. Clear auto-detect cache for a cluster
  ipcMain.handle(
    'kuberneter:clear-prometheus-cache',
    (_, kubeconfigPath?: string, contextName?: string) => {
      const cacheKey = `${kubeconfigPath ?? 'default'}:${contextName ?? 'default'}`;
      discoveredPromCache.delete(cacheKey);
      return { ok: true };
    }
  );
}
