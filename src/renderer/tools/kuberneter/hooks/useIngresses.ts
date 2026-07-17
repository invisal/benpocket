import { useMemo } from 'react';
import { useKubeQuery } from './useKubeQuery';
import { type IngressData, type IngressRuleData } from '../types/IngressData';
import { type K8sResource } from '../types/K8sResource';
import { formatAge } from '../utils/formatAge';

interface IngressK8sResource {
  metadata?: K8sResource['metadata'];
  spec?: {
    rules?: Array<{
      host?: string;
      http?: {
        paths?: Array<{
          path?: string;
          backend?: {
            service?: {
              name?: string;
              port?: {
                number?: number;
                name?: string;
              };
            };
            serviceName?: string;
            servicePort?: string | number;
          };
        }>;
      };
    }>;
    defaultBackend?: {
      service?: {
        name?: string;
        port?: {
          number?: number;
          name?: string;
        };
      };
      serviceName?: string;
      servicePort?: string | number;
    };
  };
  status?: {
    loadBalancer?: {
      ingress?: Array<{
        ip?: string;
        hostname?: string;
      }>;
    };
  };
}

export function useIngresses(enabled: boolean) {
  const transform = useMemo(
    () => (items: K8sResource[]) => {
      return items.map((item) => {
        const ingItem = item as unknown as IngressK8sResource;
        const name = ingItem.metadata?.name || '';
        const ns = ingItem.metadata?.namespace || '';
        const creationTimestamp = ingItem.metadata?.creationTimestamp || '';

        // Extract LoadBalancers
        const lbList: string[] = [];
        ingItem.status?.loadBalancer?.ingress?.forEach((lb) => {
          if (lb.ip) lbList.push(lb.ip);
          else if (lb.hostname) lbList.push(lb.hostname);
        });
        const loadBalancers = lbList.join(', ') || '—';

        // Extract Rules and Ports
        const rulesList: IngressRuleData[] = [];
        const portList: string[] = [];
        const rulesStrList: string[] = [];

        ingItem.spec?.rules?.forEach((rule) => {
          const host = rule.host || '*';
          rule.http?.paths?.forEach((p) => {
            const path = p.path || '/';
            const serviceName = p.backend?.service?.name || p.backend?.serviceName || '—';
            const servicePort =
              p.backend?.service?.port?.number ||
              p.backend?.service?.port?.name ||
              p.backend?.servicePort ||
              '—';

            const link = `http://${host}${path}`;
            rulesList.push({
              host: rule.host || '',
              path,
              link,
              serviceName,
              servicePort: String(servicePort)
            });

            rulesStrList.push(`${link} → ${serviceName}:${servicePort}`);
            if (servicePort) {
              portList.push(String(servicePort));
            }
          });
        });

        // Fallback for default backend if no rules are defined
        if (rulesList.length === 0 && ingItem.spec?.defaultBackend) {
          const db = ingItem.spec.defaultBackend;
          const serviceName = db.service?.name || db.serviceName || '—';
          const servicePort =
            db.service?.port?.number || db.service?.port?.name || db.servicePort || '—';
          rulesList.push({
            host: '*',
            path: '*',
            link: 'http://*/*',
            serviceName,
            servicePort: String(servicePort)
          });
          rulesStrList.push(`http://*/* → ${serviceName}:${servicePort}`);
          if (servicePort) {
            portList.push(String(servicePort));
          }
        }

        const rulesStr = rulesStrList.join(', ') || '—';
        const ports = Array.from(new Set(portList)).join(', ') || '—';

        return {
          id: `${ns}/${name}`,
          name,
          ns,
          loadBalancers,
          rules: rulesList,
          rulesStr,
          ports,
          age: formatAge(creationTimestamp),
          createdTime: creationTimestamp ? new Date(creationTimestamp).toLocaleString() : '',
          labels: ingItem.metadata?.labels,
          annotations: ingItem.metadata?.annotations,
          rawItem: ingItem
        };
      });
    },
    []
  );

  return useKubeQuery<IngressData>('ingresses', transform, enabled);
}
