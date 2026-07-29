import https from 'https';
import { URL } from 'url';
import { buildKubeApiPath } from '../constants/k8sResources';

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
   * Direct REST API client service transport helper.
   * Performs direct REST HTTP/HTTPS requests to API Server endpoint when endpoint URL is supplied.
   */
  public static async getResourcesDirect(
    configPath?: string,
    contextName?: string,
    resource?: string,
    namespace?: string,
    apiConfig?: KubeApiConfig
  ): Promise<{ items?: unknown[]; error?: string } | null> {
    void configPath;
    void contextName;

    if (!apiConfig || !apiConfig.server || !resource) {
      return null;
    }

    try {
      const path = this.buildResourcePath(resource, namespace);
      const fullUrl = `${apiConfig.server.replace(/\/$/, '')}${path}`;
      const urlObj = new URL(fullUrl);

      const caBuffer =
        apiConfig.caData && apiConfig.caData !== 'DATA+OMITTED'
          ? Buffer.from(apiConfig.caData, 'base64')
          : undefined;

      const certBuffer =
        apiConfig.certData && apiConfig.certData !== 'DATA+OMITTED'
          ? Buffer.from(apiConfig.certData, 'base64')
          : undefined;

      const keyBuffer =
        apiConfig.keyData && apiConfig.keyData !== 'DATA+OMITTED'
          ? Buffer.from(apiConfig.keyData, 'base64')
          : undefined;

      const requestOptions: https.RequestOptions = {
        hostname: urlObj.hostname,
        port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
        path: `${urlObj.pathname}${urlObj.search}`,
        method: 'GET',
        headers: {
          Accept: 'application/json',
          ...(apiConfig.token ? { Authorization: `Bearer ${apiConfig.token}` } : {})
        },
        ca: caBuffer,
        cert: certBuffer,
        key: keyBuffer,
        rejectUnauthorized: false
      };

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
        console.log(resource, '--- Direct api');
        const parsed = JSON.parse(response.data);
        return { items: parsed.items || [] };
      }
    } catch (err) {
      console.log(resource, '--- Direct API call failed:', err);
      // Return null to signal fallback to KubeCliService
      return null;
    }

    return null;
  }
}
