import https from 'https';
import { URL } from 'url';
import { KubernetesObjectApi, type KubernetesObject } from '@kubernetes/client-node';
import * as jsYaml from 'js-yaml';
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
      // Return null to signal fallback to KubeCliService (kubectl)
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
   * Applies or updates a resource YAML directly via @kubernetes/client-node KubernetesObjectApi.
   * Attempts create first; on 409 conflict, attempts replace.
   */
  public static async applyResourceYamlDirect(
    configPath: string | undefined,
    contextName: string | undefined,
    yamlContent: string
  ): Promise<{ result?: string; error?: string } | null> {
    try {
      const kc = KubeConfigService.loadKubeConfig(configPath, contextName);
      const client = KubernetesObjectApi.makeApiClient(kc);

      const spec = jsYaml.load(yamlContent) as KubernetesObject;
      if (!spec || typeof spec !== 'object' || !spec.apiVersion || !spec.kind) {
        return { error: 'Invalid YAML: missing apiVersion or kind' };
      }

      try {
        const createRes = (await client.create(spec)) as KubernetesObject;
        const name = createRes.metadata?.name || spec.metadata?.name || 'resource';
        return { result: `created resource ${spec.kind}/${name}` };
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
            const replaceRes = (await client.replace(spec)) as KubernetesObject;
            const name = replaceRes.metadata?.name || spec.metadata?.name || 'resource';
            return { result: `configured resource ${spec.kind}/${name}` };
          } catch (replaceErr: unknown) {
            const rErr = replaceErr as { body?: { message?: string }; message?: string };
            const msg = rErr.body?.message || rErr.message || 'Replace failed';
            return { error: msg };
          }
        }

        const msg = k8sErr.body?.message || k8sErr.message || 'Create failed';
        return { error: msg };
      }
    } catch (err) {
      console.warn('[KubeClientService] applyResourceYamlDirect failed:', err);
      return null;
    }
  }
}
