import https from 'https';
import { URL } from 'url';
import {
  ApiException,
  KubernetesObjectApi,
  PatchStrategy,
  type KubernetesObject
} from '@kubernetes/client-node';
import * as jsYaml from 'js-yaml';
import { normalizeCpuString, normalizeMemoryString } from '../utils/metricsNormalizer';
import { buildKubeApiPath } from '../constants/k8sResources';
import { KubeConfigService } from './KubeConfigService';

export class KubeClientService {
  /**
   * Helper to construct API URL path for a resource and namespace
   */
  public static buildResourcePath(resource: string, namespace?: string): string {
    return buildKubeApiPath(resource, namespace);
  }

  /**
   * Direct REST API client service powered by @kubernetes/client-node.
   * Executes HTTP/HTTPS requests to the cluster API Server endpoint using KubeConfig auth & TLS settings.
   */
  public static async getResourcesDirect(
    configPath?: string,
    contextName?: string,
    resource?: string,
    namespace?: string
  ): Promise<{ items?: unknown[]; error?: string } | null> {
    if (!resource) {
      return null;
    }

    try {
      const kc = KubeConfigService.loadKubeConfig(configPath, contextName);
      const cluster = kc.getCurrentCluster();

      if (!cluster || !cluster.server) {
        return null;
      }

      const path = this.buildResourcePath(resource, namespace);
      const fullUrl = `${cluster.server.replace(/\/$/, '')}${path}`;
      const urlObj = new URL(fullUrl);

      const requestOptions: https.RequestOptions = {
        hostname: urlObj.hostname,
        port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
        path: `${urlObj.pathname}${urlObj.search}`,
        method: 'GET',
        headers: {
          Accept: 'application/json'
        }
      };

      // Apply TLS certs, CA, skipTLSVerify, agent, and Bearer / exec tokens via @kubernetes/client-node
      await kc.applyToHTTPSOptions(requestOptions);

      if (cluster.skipTLSVerify) {
        requestOptions.rejectUnauthorized = false;
      }

      const response = await new Promise<{ status: number; data: string }>((resolve, reject) => {
        const req = https.request(requestOptions, (res) => {
          let body = '';
          res.on('data', (chunk) => {
            body += chunk.toString('utf8');
          });
          res.on('end', () => {
            resolve({ status: res.statusCode || 500, data: body });
          });
        });

        req.on('error', (err) => {
          reject(err);
        });

        req.end();
      });

      if (response.status === 200) {
        const parsed = JSON.parse(response.data);
        return { items: parsed.items || [] };
      }
    } catch (err) {
      console.log(`[KubeClientService] Direct API call failed for ${resource}:`, err);
      return null;
    }

    return null;
  }

  /**
   * Directly queries a resource's YAML via @kubernetes/client-node REST API.
   * Strips noisy metadata (managedFields, status) per configuration.
   */
  public static async getResourceYamlDirect(
    configPath: string | undefined,
    contextName: string | undefined,
    resource: string,
    name: string,
    namespace?: string
  ): Promise<{ yaml?: string; error?: string } | null> {
    try {
      const kc = KubeConfigService.loadKubeConfig(configPath, contextName);
      const cluster = kc.getCurrentCluster();
      if (!cluster || !cluster.server) return null;

      const basePath = this.buildResourcePath(resource, namespace);
      const fullUrl = `${cluster.server.replace(/\/$/, '')}${basePath}/${name}`;
      const urlObj = new URL(fullUrl);

      const requestOptions: https.RequestOptions = {
        hostname: urlObj.hostname,
        port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
        path: `${urlObj.pathname}${urlObj.search}`,
        method: 'GET',
        headers: {
          Accept: 'application/json'
        }
      };

      await kc.applyToHTTPSOptions(requestOptions);
      if (cluster.skipTLSVerify) {
        requestOptions.rejectUnauthorized = false;
      }

      const response = await new Promise<{ status: number; data: string }>((resolve, reject) => {
        const req = https.request(requestOptions, (res) => {
          let body = '';
          res.on('data', (chunk) => {
            body += chunk.toString('utf8');
          });
          res.on('end', () => {
            resolve({ status: res.statusCode || 500, data: body });
          });
        });

        req.on('error', (err) => {
          reject(err);
        });

        req.end();
      });

      if (response.status === 200) {
        const obj = JSON.parse(response.data);
        if (obj.metadata) {
          delete obj.metadata.managedFields;
        }

        const yaml = jsYaml.dump(obj);
        return { yaml };
      }
    } catch (err) {
      console.warn('[KubeClientService] getResourceYamlDirect failed:', err);
      return null;
    }

    return null;
  }

  /**
   * Cordons or uncordons a Node by updating spec.unschedulable via strategic merge patch.
   */
  public static async cordonNodeDirect(
    configPath: string | undefined,
    contextName: string | undefined,
    nodeName: string,
    unschedulable: boolean
  ): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const kc = KubeConfigService.loadKubeConfig(configPath, contextName);
      const cluster = kc.getCurrentCluster();
      if (!cluster || !cluster.server) {
        return { success: false, error: 'No active cluster configuration' };
      }

      const fullUrl = `${cluster.server.replace(/\/$/, '')}/api/v1/nodes/${nodeName}`;
      const urlObj = new URL(fullUrl);
      const patchBody = JSON.stringify({ spec: { unschedulable } });

      const requestOptions: https.RequestOptions = {
        hostname: urlObj.hostname,
        port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
        path: `${urlObj.pathname}${urlObj.search}`,
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/strategic-merge-patch+json',
          'Content-Length': Buffer.byteLength(patchBody)
        }
      };

      await kc.applyToHTTPSOptions(requestOptions);
      if (cluster.skipTLSVerify) {
        requestOptions.rejectUnauthorized = false;
      }

      const response = await new Promise<{ status: number; data: string }>((resolve, reject) => {
        const req = https.request(requestOptions, (res) => {
          let body = '';
          res.on('data', (chunk) => {
            body += chunk.toString('utf8');
          });
          res.on('end', () => resolve({ status: res.statusCode || 500, data: body }));
        });
        req.on('error', reject);
        req.write(patchBody);
        req.end();
      });

      if (response.status >= 200 && response.status < 300) {
        const action = unschedulable ? 'cordoned' : 'uncordoned';
        return { success: true, message: `Node ${nodeName} ${action} successfully` };
      } else {
        return { success: false, error: `HTTP ${response.status}: ${response.data}` };
      }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  /**
   * Sanitizes a Kubernetes manifest for applying by stripping server-managed/read-only fields.
   */
  public static sanitizeManifestForApply(spec: KubernetesObject): KubernetesObject {
    const cleaned = JSON.parse(JSON.stringify(spec)) as KubernetesObject;
    if (cleaned.metadata) {
      delete (cleaned.metadata as Record<string, unknown>).resourceVersion;
      delete (cleaned.metadata as Record<string, unknown>).uid;
      delete (cleaned.metadata as Record<string, unknown>).creationTimestamp;
      delete (cleaned.metadata as Record<string, unknown>).generation;
      delete (cleaned.metadata as Record<string, unknown>).managedFields;
      delete (cleaned.metadata as Record<string, unknown>).selfLink;
    }
    delete (cleaned as Record<string, unknown>).status;
    return cleaned;
  }

  /**
   * Extracts an HTTP status code and human-readable message from an error thrown by
   * @kubernetes/client-node. Newer client-node versions (>=1.x) throw `ApiException`, whose
   * `.code` is the numeric HTTP status and whose `.body` is the *raw response text* (a string),
   * not a parsed object — so `.body.code` / `.body.message` are always undefined and must be
   * parsed out of the JSON string first. Older client shapes (`statusCode` / `response.statusCode`
   * / parsed `body.code`) are also supported as a fallback.
   */
  private static parseK8sError(err: unknown): { code?: number; message?: string } {
    if (err instanceof ApiException) {
      let parsedBody: { code?: number; message?: string; reason?: string } | undefined;
      if (typeof err.body === 'string') {
        try {
          parsedBody = JSON.parse(err.body);
        } catch {
          parsedBody = undefined;
        }
      } else if (err.body && typeof err.body === 'object') {
        parsedBody = err.body as { code?: number; message?: string; reason?: string };
      }
      return {
        code: err.code ?? parsedBody?.code,
        message: parsedBody?.message || err.message
      };
    }

    const k8sErr = err as {
      statusCode?: number;
      response?: { statusCode?: number };
      body?: { code?: number; message?: string } | string;
      message?: string;
    };
    let bodyCode: number | undefined;
    let bodyMessage: string | undefined;
    if (typeof k8sErr.body === 'string') {
      try {
        const parsed = JSON.parse(k8sErr.body);
        bodyCode = parsed.code;
        bodyMessage = parsed.message;
      } catch {
        // not JSON, ignore
      }
    } else if (k8sErr.body && typeof k8sErr.body === 'object') {
      bodyCode = k8sErr.body.code;
      bodyMessage = k8sErr.body.message;
    }

    return {
      code: k8sErr.statusCode ?? k8sErr.response?.statusCode ?? bodyCode,
      message: bodyMessage || k8sErr.message
    };
  }

  /**
   * @kubernetes/client-node deserializes API responses into typed class instances (V1Deployment,
   * V1ObjectMeta, etc.), not plain objects. js-yaml's `dump()` can only serialize plain
   * objects/arrays/primitives and throws "unacceptable kind of an object to dump" on a class
   * instance, so responses must be round-tripped through JSON before being handed to jsYaml.dump.
   */
  private static toPlainObject<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj));
  }

  /**
   * Applies one or more Kubernetes resources from a YAML document, mirroring
   * `kubectl apply --server-side --force-conflicts`:
   *
   * - Supports multi-document YAML (`---`-separated), applying each resource in turn, the
   *   same way `kubectl apply -f` walks every document in a manifest.
   * - Uses a single Server-Side Apply PATCH (`application/apply-patch+yaml`) per resource.
   *   SSA is create-or-update in one call — the API server creates the object if it's missing
   *   and merges into it if it exists — so there is no separate create/replace step. Unlike a
   *   raw PUT (`replace`), fields owned by other actors that aren't in this YAML are left alone,
   *   which is the actual guarantee "apply" is supposed to provide.
   * - `force: true` re-acquires fields owned by another field manager, matching
   *   `--force-conflicts`, since this is a GUI action the user explicitly initiated.
   * - Reports "created" vs "configured" per resource the same way kubectl does: by checking
   *   whether the object existed before the apply.
   *
   * On a genuine SSA failure (bad RBAC, invalid manifest, unknown kind, etc.) the real server
   * error is surfaced directly rather than retried through a different, less safe code path.
   */
  public static async applyResourceYamlDirect(
    configPath: string | undefined,
    contextName: string | undefined,
    yamlContent: string
  ): Promise<{ result?: string; error?: string; yaml?: string } | null> {
    try {
      const kc = KubeConfigService.loadKubeConfig(configPath, contextName);
      const client = KubernetesObjectApi.makeApiClient(kc);

      const rawDocs = (jsYaml.loadAll(yamlContent) as unknown[]).filter(
        (doc): doc is KubernetesObject => !!doc && typeof doc === 'object'
      );

      if (rawDocs.length === 0) {
        return { error: 'No Kubernetes resources found in YAML' };
      }
      const invalidDoc = rawDocs.find((doc) => !doc.apiVersion || !doc.kind);
      if (invalidDoc) {
        return { error: 'Invalid YAML: every document must have apiVersion and kind' };
      }

      const applied: Array<{ label: string; verb: string; yaml: string }> = [];
      const failed: Array<{ label: string; message: string }> = [];

      for (const rawSpec of rawDocs) {
        const spec = this.sanitizeManifestForApply(rawSpec);
        const label = `${spec.kind}/${spec.metadata?.name ?? 'unknown'}`;
        const specHeader = spec as KubernetesObject & {
          metadata: { name: string; namespace?: string };
        };

        // Check existence first (like kubectl's apply.go) purely for "created" vs "configured"
        // messaging. If the GET itself is inconclusive (e.g. no read RBAC), don't guess.
        let existedBefore: boolean | undefined;
        try {
          await client.read(specHeader);
          existedBefore = true;
        } catch (readErr) {
          const { code } = this.parseK8sError(readErr);
          existedBefore = code === 404 ? false : undefined;
        }

        try {
          const patchRes = (await client.patch(
            spec,
            undefined,
            undefined,
            'benPocket',
            true,
            PatchStrategy.ServerSideApply
          )) as KubernetesObject;
          const verb =
            existedBefore === undefined ? 'applied' : existedBefore ? 'configured' : 'created';
          applied.push({ label, verb, yaml: jsYaml.dump(this.toPlainObject(patchRes)) });
        } catch (patchErr) {
          const { message } = this.parseK8sError(patchErr);
          console.warn(`[KubeClientService] Server-Side Apply failed for ${label}:`, message);
          failed.push({ label, message: message || 'Apply failed' });
        }
      }

      if (failed.length > 0) {
        const failureSummary = failed.map((f) => `${f.label}: ${f.message}`).join('\n');
        if (applied.length > 0) {
          const successSummary = applied.map((a) => `${a.label} ${a.verb}`).join(', ');
          return { error: `${successSummary}; failed:\n${failureSummary}` };
        }
        return { error: failureSummary };
      }

      return {
        result: applied.map((a) => `${a.label} ${a.verb}`).join('\n'),
        yaml: applied.map((a) => a.yaml).join('---\n')
      };
    } catch (err) {
      console.warn('[KubeClientService] applyResourceYamlDirect failed:', err);
      return { error: err instanceof Error ? err.message : 'Failed to apply resource YAML' };
    }
  }

  /**
   * Direct REST API call for K8s Metrics API (/apis/metrics.k8s.io/v1beta1/...)
   */
  public static async getMetricsDirect(
    configPath?: string,
    contextName?: string,
    subPath: string = 'nodes'
  ): Promise<{ items?: unknown[]; error?: string } | null> {
    try {
      const kc = KubeConfigService.loadKubeConfig(configPath, contextName);
      const cluster = kc.getCurrentCluster();

      if (!cluster || !cluster.server) {
        return null;
      }

      const path = `/apis/metrics.k8s.io/v1beta1/${subPath}`;
      const fullUrl = `${cluster.server.replace(/\/$/, '')}${path}`;
      const urlObj = new URL(fullUrl);

      const requestOptions: https.RequestOptions = {
        hostname: urlObj.hostname,
        port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
        path: `${urlObj.pathname}${urlObj.search}`,
        method: 'GET',
        headers: {
          Accept: 'application/json'
        }
      };

      await kc.applyToHTTPSOptions(requestOptions);
      if (cluster.skipTLSVerify) {
        requestOptions.rejectUnauthorized = false;
      }

      const response = await new Promise<{ status: number; data: string }>((resolve, reject) => {
        const req = https.request(requestOptions, (res) => {
          let body = '';
          res.on('data', (chunk) => (body += chunk));
          res.on('end', () => resolve({ status: res.statusCode || 500, data: body }));
        });
        req.on('error', reject);
        req.end();
      });

      if (response.status >= 200 && response.status < 300) {
        const parsed = JSON.parse(response.data) as { items?: unknown[] };
        const rawItems = parsed.items || [];

        // Normalize metrics directly in getMetricsDirect so all callers receive clean data once
        if (subPath.includes('nodes')) {
          const items = rawItems.map((rawItem: unknown) => {
            const item = (rawItem || {}) as Record<string, unknown>;
            const meta = item.metadata as { name?: string } | undefined;
            const usage = item.usage as { cpu?: string; memory?: string } | undefined;
            return {
              metadata: { name: meta?.name || 'unknown' },
              usage: {
                cpu: normalizeCpuString(usage?.cpu),
                memory: normalizeMemoryString(usage?.memory)
              }
            };
          });
          return { items };
        }

        if (subPath.includes('pods')) {
          const items = rawItems.map((rawItem: unknown) => {
            const item = (rawItem || {}) as Record<string, unknown>;
            const meta = item.metadata as { name?: string; namespace?: string } | undefined;
            const containers = item.containers as
              Array<{ usage?: { cpu?: string; memory?: string } }> | undefined;

            let totalCpuNano = 0;
            let totalMemKi = 0;

            if (Array.isArray(containers)) {
              for (const c of containers) {
                const cCpu = c?.usage?.cpu || '0';
                const cMem = c?.usage?.memory || '0';

                if (cCpu.endsWith('n')) totalCpuNano += parseFloat(cCpu.slice(0, -1)) || 0;
                else if (cCpu.endsWith('u'))
                  totalCpuNano += (parseFloat(cCpu.slice(0, -1)) || 0) * 1e3;
                else if (cCpu.endsWith('m'))
                  totalCpuNano += (parseFloat(cCpu.slice(0, -1)) || 0) * 1e6;
                else totalCpuNano += (parseFloat(cCpu) || 0) * 1e9;

                if (cMem.endsWith('Ki')) totalMemKi += parseFloat(cMem.slice(0, -2)) || 0;
                else if (cMem.endsWith('Mi'))
                  totalMemKi += (parseFloat(cMem.slice(0, -2)) || 0) * 1024;
                else if (cMem.endsWith('Gi'))
                  totalMemKi += (parseFloat(cMem.slice(0, -2)) || 0) * 1024 * 1024;
                else totalMemKi += (parseFloat(cMem) || 0) / 1024;
              }
            }

            return {
              metadata: {
                name: meta?.name || 'unknown',
                namespace: meta?.namespace || 'default'
              },
              usage: {
                cpu: normalizeCpuString(`${totalCpuNano}n`),
                memory: normalizeMemoryString(`${totalMemKi}Ki`)
              }
            };
          });
          return { items };
        }

        return { items: rawItems };
      }
      return null;
    } catch (err) {
      console.warn('[KubeClientService] getMetricsDirect failed:', err);
      return null;
    }
  }
}
