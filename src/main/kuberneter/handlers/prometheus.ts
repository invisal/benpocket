import { ipcMain } from 'electron';
import * as net from 'net';
import { spawn } from 'child_process';
import type { ChildProcess } from 'child_process';

interface DiscoveredPromService {
  namespace: string;
  name: string;
  port: number;
}

// In-memory cache for discovered Prometheus endpoint per context
const discoveredPromCache = new Map<string, DiscoveredPromService>();

/** Find a free TCP port on localhost */
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

/** Wait for kubectl port-forward to print "Forwarding from" — signals it is ready */
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

/** Lens-style Auto-Discovery for Prometheus service across all cluster namespaces */
async function discoverPrometheusService(
  kubeconfigPath?: string,
  contextName?: string
): Promise<DiscoveredPromService> {
  const cacheKey = `${kubeconfigPath || 'default'}:${contextName || 'default'}`;
  if (discoveredPromCache.has(cacheKey)) {
    return discoveredPromCache.get(cacheKey)!;
  }

  const defaults: DiscoveredPromService[] = [
    { namespace: 'lens-metrics', name: 'prometheus', port: 80 },
    { namespace: 'monitoring', name: 'prometheus-k8s', port: 9090 },
    { namespace: 'monitoring', name: 'prometheus-stack-kube-prom-prometheus', port: 9090 },
    { namespace: 'monitoring', name: 'prometheus-server', port: 80 },
    { namespace: 'prometheus', name: 'prometheus', port: 9090 },
    { namespace: 'kube-system', name: 'prometheus', port: 9090 }
  ];

  return new Promise((resolve) => {
    const args: string[] = [];
    if (kubeconfigPath) args.push('--kubeconfig', kubeconfigPath);
    if (contextName) args.push('--context', contextName);
    args.push('get', 'svc', '-A', '-o', 'json');

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

          // 1. Check priority matches
          for (const def of defaults) {
            const match = items.find(
              (item) =>
                item.metadata?.namespace === def.namespace && item.metadata?.name === def.name
            );
            if (match) {
              const targetPort = match.spec?.ports?.[0]?.port || def.port;
              const result = { namespace: def.namespace, name: def.name, port: targetPort };
              discoveredPromCache.set(cacheKey, result);
              return resolve(result);
            }
          }

          // 2. Search for any service matching prometheus in name or labels
          for (const item of items) {
            const name = item.metadata?.name || '';
            const ns = item.metadata?.namespace || 'default';
            const labels = item.metadata?.labels || {};
            const isProm =
              name.includes('prometheus') ||
              labels['app'] === 'prometheus' ||
              labels['app.kubernetes.io/name'] === 'prometheus' ||
              labels['app.kubernetes.io/instance']?.includes('prometheus');

            if (isProm) {
              const targetPort = item.spec?.ports?.[0]?.port || 9090;
              const result = { namespace: ns, name: name, port: targetPort };
              discoveredPromCache.set(cacheKey, result);
              return resolve(result);
            }
          }
        } catch {
          // Ignore JSON parse error
        }
      }

      // Default fallback if scan doesn't find any service
      const fallback = defaults[2];
      resolve(fallback);
    });

    proc.on('error', () => {
      resolve(defaults[2]);
    });
  });
}

/** Query Prometheus HTTP API with a PromQL instant query. */
async function queryPromQL(
  localPort: number,
  promql: string
): Promise<{ metric: Record<string, string>; value: [number, string] }[]> {
  const encoded = encodeURIComponent(promql);
  const url = `http://127.0.0.1:${localPort}/api/v1/query?query=${encoded}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) {
    throw new Error(`Prometheus HTTP ${res.status}: ${res.statusText}`);
  }
  const json = (await res.json()) as {
    status: string;
    data: {
      resultType: string;
      result: { metric: Record<string, string>; value: [number, string] }[];
    };
  };
  if (json.status !== 'success') {
    throw new Error(`Prometheus returned status: ${json.status}`);
  }
  return json.data.result;
}

/** Query Prometheus HTTP API with a PromQL range query. */
async function queryPromQLRange(
  localPort: number,
  promql: string,
  startUnix: number,
  endUnix: number,
  stepSeconds: number
): Promise<Array<[number, string]>> {
  const encoded = encodeURIComponent(promql);
  const url = `http://127.0.0.1:${localPort}/api/v1/query_range?query=${encoded}&start=${startUnix}&end=${endUnix}&step=${stepSeconds}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) {
    return [];
  }
  const json = (await res.json()) as {
    status: string;
    data: {
      result: Array<{
        metric: Record<string, string>;
        values: Array<[number, string]>;
      }>;
    };
  };
  if (json.status !== 'success' || !json.data.result || json.data.result.length === 0) {
    return [];
  }
  return json.data.result[0].values;
}

export function registerPrometheusHandler(): void {
  // 1. Query instantaneous pod metrics
  ipcMain.handle(
    'kuberneter:query-prometheus',
    async (
      _,
      kubeconfigPath: string | undefined,
      contextName: string | undefined,
      prometheusNamespace?: string,
      prometheusService?: string,
      prometheusPort?: number
    ) => {
      let portForwardProc: ChildProcess | null = null;
      try {
        const resolvedKubeconfig = kubeconfigPath || undefined;

        // Auto-discover Prometheus service if not explicitly provided
        let targetNs = prometheusNamespace;
        let targetSvc = prometheusService;
        let targetPortNum = prometheusPort;

        if (!targetNs || !targetSvc || !targetPortNum) {
          const discovered = await discoverPrometheusService(resolvedKubeconfig, contextName);
          targetNs = targetNs || discovered.namespace;
          targetSvc = targetSvc || discovered.name;
          targetPortNum = targetPortNum || discovered.port;
        }

        const localPort = await getFreePort();

        const pfArgs: string[] = [];
        if (resolvedKubeconfig) pfArgs.push('--kubeconfig', resolvedKubeconfig);
        if (contextName) pfArgs.push('--context', contextName);
        pfArgs.push(
          'port-forward',
          `svc/${targetSvc}`,
          `${localPort}:${targetPortNum}`,
          '-n',
          targetNs
        );

        portForwardProc = spawn('kubectl', pfArgs, { shell: true });
        await waitForPortForward(portForwardProc);

        const cpuQuery =
          'sum(rate(container_cpu_usage_seconds_total{container!="",container!="POD"}[5m])) by (pod, namespace)';
        const memQuery =
          'sum(container_memory_working_set_bytes{container!="",container!="POD"}) by (pod, namespace)';

        const [cpuResults, memResults] = await Promise.all([
          queryPromQL(localPort, cpuQuery),
          queryPromQL(localPort, memQuery)
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
          if (!isNaN(bytes)) {
            const mib = bytes / (1024 * 1024);
            memMap.set(key, `${mib.toFixed(3)}Mi`);
          }
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

        return { items };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { error: message, items: [] };
      } finally {
        if (portForwardProc && !portForwardProc.killed) {
          portForwardProc.kill('SIGTERM');
        }
      }
    }
  );

  // 2. Query range time-series metrics (CPU, Memory, Network, Filesystem) for Pod & Containers
  ipcMain.handle(
    'kuberneter:query-pod-metrics-range',
    async (
      _,
      params: {
        kubeconfigPath?: string;
        contextName?: string;
        namespace: string;
        podName: string;
        timeRange?: '1h' | '6h' | '24h';
        prometheusNamespace?: string;
        prometheusService?: string;
        prometheusPort?: number;
      }
    ) => {
      const {
        kubeconfigPath,
        contextName,
        namespace,
        podName,
        timeRange = '1h',
        prometheusNamespace,
        prometheusService,
        prometheusPort
      } = params;

      let portForwardProc: ChildProcess | null = null;
      try {
        // Auto-discover Prometheus service if not explicitly provided
        let targetNs = prometheusNamespace;
        let targetSvc = prometheusService;
        let targetPortNum = prometheusPort;

        if (!targetNs || !targetSvc || !targetPortNum) {
          const discovered = await discoverPrometheusService(kubeconfigPath, contextName);
          targetNs = targetNs || discovered.namespace;
          targetSvc = targetSvc || discovered.name;
          targetPortNum = targetPortNum || discovered.port;
        }

        const localPort = await getFreePort();
        const pfArgs: string[] = [];
        if (kubeconfigPath) pfArgs.push('--kubeconfig', kubeconfigPath);
        if (contextName) pfArgs.push('--context', contextName);
        pfArgs.push(
          'port-forward',
          `svc/${targetSvc}`,
          `${localPort}:${targetPortNum}`,
          '-n',
          targetNs
        );

        portForwardProc = spawn('kubectl', pfArgs, { shell: true });
        await waitForPortForward(portForwardProc);

        const endUnix = Math.floor(Date.now() / 1000);
        const spanSec = timeRange === '24h' ? 86400 : timeRange === '6h' ? 21600 : 3600;
        const startUnix = endUnix - spanSec;
        const stepSec = Math.max(15, Math.floor(spanSec / 10));

        // PromQL Queries
        const cpuUsageQuery = `sum(rate(container_cpu_usage_seconds_total{namespace="${namespace}",pod="${podName}",container!="",container!="POD"}[5m]))`;
        const cpuReqQuery = `sum(kube_pod_container_resource_requests{namespace="${namespace}",pod="${podName}",resource="cpu"})`;
        const cpuLimQuery = `sum(kube_pod_container_resource_limits{namespace="${namespace}",pod="${podName}",resource="cpu"})`;

        const memUsageQuery = `sum(container_memory_working_set_bytes{namespace="${namespace}",pod="${podName}",container!="",container!="POD"})`;
        const memReqQuery = `sum(kube_pod_container_resource_requests{namespace="${namespace}",pod="${podName}",resource="memory"})`;
        const memLimQuery = `sum(kube_pod_container_resource_limits{namespace="${namespace}",pod="${podName}",resource="memory"})`;

        const netRxQuery = `sum(rate(container_network_receive_bytes_total{namespace="${namespace}",pod="${podName}"}[5m]))`;
        const netTxQuery = `sum(rate(container_network_transmit_bytes_total{namespace="${namespace}",pod="${podName}"}[5m]))`;

        const fsUsageQuery = `sum(container_fs_usage_bytes{namespace="${namespace}",pod="${podName}",container!="",container!="POD"})`;
        const fsLimitQuery = `sum(container_fs_limit_hash{namespace="${namespace}",pod="${podName}"} or container_fs_limit_bytes{namespace="${namespace}",pod="${podName}"})`;

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
          queryPromQLRange(localPort, cpuUsageQuery, startUnix, endUnix, stepSec),
          queryPromQLRange(localPort, cpuReqQuery, startUnix, endUnix, stepSec),
          queryPromQLRange(localPort, cpuLimQuery, startUnix, endUnix, stepSec),
          queryPromQLRange(localPort, memUsageQuery, startUnix, endUnix, stepSec),
          queryPromQLRange(localPort, memReqQuery, startUnix, endUnix, stepSec),
          queryPromQLRange(localPort, memLimQuery, startUnix, endUnix, stepSec),
          queryPromQLRange(localPort, netRxQuery, startUnix, endUnix, stepSec),
          queryPromQLRange(localPort, netTxQuery, startUnix, endUnix, stepSec),
          queryPromQLRange(localPort, fsUsageQuery, startUnix, endUnix, stepSec),
          queryPromQLRange(localPort, fsLimitQuery, startUnix, endUnix, stepSec)
        ]);

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
          const month = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          const hours = String(d.getHours()).padStart(2, '0');
          const mins = String(d.getMinutes()).padStart(2, '0');
          return timeRange === '24h' ? `${month}/${day} ${hours}:${mins}` : `${hours}:${mins}`;
        });

        const cpuUsage = rawCpuUsage.map(([, val]) => parseFloat(val) || 0);
        const cpuReq = rawCpuReq.map(([, val]) => parseFloat(val) || 0);
        const cpuLim = rawCpuLim.map(([, val]) => parseFloat(val) || 0);

        const memUsage = rawMemUsage.map(([, val]) => (parseFloat(val) || 0) / (1024 * 1024));
        const memReq = rawMemReq.map(([, val]) => (parseFloat(val) || 0) / (1024 * 1024));
        const memLim = rawMemLim.map(([, val]) => (parseFloat(val) || 0) / (1024 * 1024));

        const netRx = rawNetRx.map(([, val]) => (parseFloat(val) || 0) / 1024);
        const netTx = rawNetTx.map(([, val]) => (parseFloat(val) || 0) / 1024);

        const fsUsage = rawFsUsage.map(([, val]) => (parseFloat(val) || 0) / (1024 * 1024));
        const fsLimit = rawFsLimit.map(([, val]) => (parseFloat(val) || 0) / (1024 * 1024));

        return {
          source: `${targetNs} / ${targetSvc}:${targetPortNum}`,
          timeLabels,
          cpu: { usage: cpuUsage, requests: cpuReq, limits: cpuLim },
          memory: { usage: memUsage, requests: memReq, limits: memLim },
          network: { rx: netRx, tx: netTx },
          filesystem: { usage: fsUsage, limit: fsLimit }
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
        if (portForwardProc && !portForwardProc.killed) {
          portForwardProc.kill('SIGTERM');
        }
      }
    }
  );
}
