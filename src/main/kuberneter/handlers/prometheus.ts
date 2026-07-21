import { ipcMain } from 'electron';
import * as net from 'net';
import { spawn } from 'child_process';
import type { ChildProcess } from 'child_process';

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

/**
 * Query the Prometheus HTTP API with a PromQL instant query.
 * Returns the raw result array from data.result.
 */
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

export function registerPrometheusHandler(): void {
  // Query real pod CPU & Memory metrics from Prometheus via kubectl port-forward
  ipcMain.handle(
    'kuberneter:query-prometheus',
    async (
      _,
      kubeconfigPath: string | undefined,
      contextName: string | undefined,
      prometheusNamespace = 'monitoring',
      prometheusService = 'prometheus-stack-kube-prom-prometheus',
      prometheusPort = 9090
    ) => {
      let portForwardProc: ChildProcess | null = null;
      try {
        const resolvedKubeconfig = kubeconfigPath || undefined;
        const localPort = await getFreePort();

        // Build kubectl port-forward args
        const pfArgs: string[] = [];
        if (resolvedKubeconfig) {
          pfArgs.push('--kubeconfig', resolvedKubeconfig);
        }
        if (contextName) {
          pfArgs.push('--context', contextName);
        }
        pfArgs.push(
          'port-forward',
          `svc/${prometheusService}`,
          `${localPort}:${prometheusPort}`,
          '-n',
          prometheusNamespace
        );

        portForwardProc = spawn('kubectl', pfArgs, { shell: true });

        // Wait until port-forward signals it's ready
        await waitForPortForward(portForwardProc);

        // Query CPU: sum of rate of CPU usage per pod/namespace (5-minute window)
        const cpuQuery =
          'sum(rate(container_cpu_usage_seconds_total{container!="",container!="POD"}[5m])) by (pod, namespace)';
        // Query Memory: working set bytes per pod/namespace (matches what Lens shows)
        const memQuery =
          'sum(container_memory_working_set_bytes{container!="",container!="POD"}) by (pod, namespace)';

        const [cpuResults, memResults] = await Promise.all([
          queryPromQL(localPort, cpuQuery),
          queryPromQL(localPort, memQuery)
        ]);

        // Build lookup maps keyed by "namespace/pod"
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
          // Convert bytes to Mi for consistent parsing downstream
          if (!isNaN(bytes)) {
            const mib = bytes / (1024 * 1024);
            memMap.set(key, `${mib.toFixed(3)}Mi`);
          }
        }

        // Merge into unified items array (union of all pods that have any metric)
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
        // Always clean up the port-forward process
        if (portForwardProc && !portForwardProc.killed) {
          portForwardProc.kill('SIGTERM');
        }
      }
    }
  );
}
