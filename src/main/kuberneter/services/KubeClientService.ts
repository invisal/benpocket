import https from 'https';
import { URL } from 'url';
import { buildKubeApiPath } from '../constants/k8sResources';
import { KubeConfigService } from './KubeConfigService';

export interface KubeApiConfig {
  server?: string;
  token?: string;
  caData?: string;
  certData?: string;
  keyData?: string;
  insecureSkipTlsVerify?: boolean;
}

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
}
