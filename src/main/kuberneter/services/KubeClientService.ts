import https from 'https';
import { URL } from 'url';

export interface KubeApiConfig {
  server?: string;
  token?: string;
  caData?: string;
  certData?: string;
  keyData?: string;
  insecureSkipTlsVerify?: boolean;
}

const RESOURCE_PATH_MAP: Record<
  string,
  { group: string; version: string; isClusterScoped?: boolean }
> = {
  pods: { group: 'api', version: 'v1' },
  services: { group: 'api', version: 'v1' },
  configmaps: { group: 'api', version: 'v1' },
  secrets: { group: 'api', version: 'v1' },
  namespaces: { group: 'api', version: 'v1', isClusterScoped: true },
  nodes: { group: 'api', version: 'v1', isClusterScoped: true },
  events: { group: 'api', version: 'v1' },
  endpoints: { group: 'api', version: 'v1' },
  persistentvolumeclaims: { group: 'api', version: 'v1' },
  pvcs: { group: 'api', version: 'v1' },
  persistentvolumes: { group: 'api', version: 'v1', isClusterScoped: true },
  pvs: { group: 'api', version: 'v1', isClusterScoped: true },
  resourcequotas: { group: 'api', version: 'v1' },
  limitranges: { group: 'api', version: 'v1' },
  serviceaccounts: { group: 'api', version: 'v1' },
  deployments: { group: 'apis/apps', version: 'v1' },
  statefulsets: { group: 'apis/apps', version: 'v1' },
  daemonsets: { group: 'apis/apps', version: 'v1' },
  replicasets: { group: 'apis/apps', version: 'v1' },
  jobs: { group: 'apis/batch', version: 'v1' },
  cronjobs: { group: 'apis/batch', version: 'v1' },
  ingresses: { group: 'apis/networking.k8s.io', version: 'v1' },
  ingressclasses: { group: 'apis/networking.k8s.io', version: 'v1', isClusterScoped: true },
  networkpolicies: { group: 'apis/networking.k8s.io', version: 'v1' },
  endpointslices: { group: 'apis/discovery.k8s.io', version: 'v1' },
  storageclasses: { group: 'apis/storage.k8s.io', version: 'v1', isClusterScoped: true },
  roles: { group: 'apis/rbac.authorization.k8s.io', version: 'v1' },
  rolebindings: { group: 'apis/rbac.authorization.k8s.io', version: 'v1' },
  bindings: { group: 'apis/rbac.authorization.k8s.io', version: 'v1' },
  clusterroles: { group: 'apis/rbac.authorization.k8s.io', version: 'v1', isClusterScoped: true },
  clusterrolebindings: {
    group: 'apis/rbac.authorization.k8s.io',
    version: 'v1',
    isClusterScoped: true
  },
  poddisruptionbudgets: { group: 'apis/policy', version: 'v1' },
  pdbs: { group: 'apis/policy', version: 'v1' },
  priorityclasses: { group: 'apis/scheduling.k8s.io', version: 'v1', isClusterScoped: true },
  runtimeclasses: { group: 'apis/node.k8s.io', version: 'v1', isClusterScoped: true },
  leases: { group: 'apis/coordination.k8s.io', version: 'v1' },
  mutatingwebhookconfigurations: {
    group: 'apis/admissionregistration.k8s.io',
    version: 'v1',
    isClusterScoped: true
  },
  validatingwebhookconfigurations: {
    group: 'apis/admissionregistration.k8s.io',
    version: 'v1',
    isClusterScoped: true
  }
};

export class KubeClientService {
  /**
   * Helper to construct API URL path for a resource and namespace
   */
  public static buildResourcePath(resource: string, namespace?: string): string {
    const key = resource.toLowerCase();
    const info = RESOURCE_PATH_MAP[key] || { group: 'api', version: 'v1' };
    const prefix = info.group === 'api' ? '/api/v1' : `/${info.group}/${info.version}`;

    if (info.isClusterScoped) {
      return `${prefix}/${key}`;
    }

    if (namespace && namespace !== 'All Namespaces') {
      return `${prefix}/namespaces/${namespace}/${key}`;
    }

    return `${prefix}/${key}`;
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
