import https from 'https';
import { URL } from 'url';
import { KubernetesObjectApi, PatchStrategy, type KubernetesObject } from '@kubernetes/client-node';
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
        console.log(`[KubeClientService] Direct API success for ${resource}`);
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
   * Applies or updates a resource YAML using Server-Side Apply (SSA) via @kubernetes/client-node.
   * Uses fieldManager 'benPocket' and PatchStrategy.ServerSideApply.
   */
  public static async applyResourceYamlDirect(
    configPath: string | undefined,
    contextName: string | undefined,
    yamlContent: string
  ): Promise<{ result?: string; error?: string; yaml?: string } | null> {
    try {
      const kc = KubeConfigService.loadKubeConfig(configPath, contextName);
      const client = KubernetesObjectApi.makeApiClient(kc);

      const rawSpec = jsYaml.load(yamlContent) as KubernetesObject;
      if (!rawSpec || typeof rawSpec !== 'object' || !rawSpec.apiVersion || !rawSpec.kind) {
        return { error: 'Invalid YAML: missing apiVersion or kind' };
      }

      const spec = this.sanitizeManifestForApply(rawSpec);

      try {
        const patchRes = (await client.patch(
          spec,
          undefined,
          undefined,
          'benPocket',
          true,
          PatchStrategy.ServerSideApply
        )) as KubernetesObject;
        const name = patchRes.metadata?.name || spec.metadata?.name || 'resource';
        const updatedYaml = jsYaml.dump(patchRes);
        return { result: `applied resource ${spec.kind}/${name}`, yaml: updatedYaml };
      } catch (patchErr: unknown) {
        // Fall back to create or replace with fieldManager if Server-Side Apply fails
        try {
          const createRes = (await client.create(
            spec,
            undefined,
            undefined,
            'benPocket'
          )) as KubernetesObject;
          const name = createRes.metadata?.name || spec.metadata?.name || 'resource';
          const updatedYaml = jsYaml.dump(createRes);
          return { result: `created resource ${spec.kind}/${name}`, yaml: updatedYaml };
        } catch (err: unknown) {
          const k8sErr = err as {
            statusCode?: number;
            response?: { statusCode?: number };
            body?: { code?: number; message?: string };
            message?: string;
          };
          const code = k8sErr.statusCode || k8sErr.response?.statusCode || k8sErr.body?.code;

          if (code === 409) {
            try {
              const replaceRes = (await client.replace(
                spec,
                undefined,
                undefined,
                'benPocket'
              )) as KubernetesObject;
              const name = replaceRes.metadata?.name || spec.metadata?.name || 'resource';
              const updatedYaml = jsYaml.dump(replaceRes);
              return { result: `configured resource ${spec.kind}/${name}`, yaml: updatedYaml };
            } catch (replaceErr: unknown) {
              const rErr = replaceErr as { body?: { message?: string }; message?: string };
              const msg = rErr.body?.message || rErr.message || 'Replace failed';
              return { error: msg };
            }
          }

          const msg =
            k8sErr.body?.message || k8sErr.message || (patchErr as Error).message || 'Apply failed';
          return { error: msg };
        }
      }
    } catch (err) {
      console.warn('[KubeClientService] applyResourceYamlDirect failed:', err);
      return null;
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
