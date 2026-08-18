import { formatAge } from '../../../utils/formatAge';
import { type IngressData, type IngressRuleData } from '../../../types/IngressData';
import { type K8sResource } from '../../../types/K8sResource';

export function buildIngressDetailPayload(
  name: string,
  namespace: string,
  rawResource?: K8sResource
): IngressData {
  const rawIng = rawResource as unknown as {
    spec?: {
      rules?: Array<{
        host?: string;
        http?: {
          paths?: Array<{
            path?: string;
            pathType?: string;
            backend?: {
              service?: { name?: string; port?: { number?: number; name?: string } };
              serviceName?: string;
              servicePort?: string | number;
            };
          }>;
        };
      }>;
      ingressClassName?: string;
    };
    status?: {
      loadBalancer?: {
        ingress?: Array<{
          ip?: string;
          hostname?: string;
        }>;
      };
    };
  };
  const rules = rawIng?.spec?.rules || [];
  const loadBalancerIngress = rawIng?.status?.loadBalancer?.ingress || [];
  const creationTimestamp = rawResource?.metadata?.creationTimestamp || '';

  const lbList: string[] = [];
  loadBalancerIngress.forEach((lb) => {
    if (lb.ip) lbList.push(lb.ip);
    else if (lb.hostname) lbList.push(lb.hostname);
  });
  const loadBalancers = lbList.join(', ') || '—';

  const rulesList: IngressRuleData[] = [];
  const portList: string[] = [];
  const rulesStrList: string[] = [];

  rules.forEach((rule) => {
    const host = rule.host || '*';
    const paths = rule.http?.paths || [];
    if (paths.length === 0) {
      rulesList.push({
        host,
        path: '—',
        link: host !== '*' ? `http://${host}` : '',
        serviceName: '—',
        servicePort: '—'
      });
      rulesStrList.push(host);
    } else {
      paths.forEach((p) => {
        const path = p.path || '—';
        const serviceName = p.backend?.service?.name || p.backend?.serviceName || '—';
        const portNum =
          p.backend?.service?.port?.number ||
          p.backend?.service?.port?.name ||
          p.backend?.servicePort;
        const portStr = portNum !== undefined ? String(portNum) : '—';
        const link = host !== '*' ? `http://${host}${path !== '—' ? path : ''}` : '';
        rulesList.push({ host, path, link, serviceName, servicePort: portStr });
        rulesStrList.push(`${host}${path !== '—' ? path : ''}`);
        if (portStr !== '—' && !portList.includes(portStr)) {
          portList.push(portStr);
        }
      });
    }
  });

  const rulesStr = rulesStrList.join(', ') || '—';
  const ports = portList.length > 0 ? portList.join(', ') : '80';

  return {
    id: `${namespace}/${name}`,
    name,
    ns: namespace,
    loadBalancers,
    rules: rulesList,
    rulesStr,
    ports,
    age: formatAge(creationTimestamp),
    createdTime: creationTimestamp ? new Date(creationTimestamp).toLocaleString() : '',
    labels: rawResource?.metadata?.labels,
    annotations: rawResource?.metadata?.annotations,
    rawItem: rawResource
  };
}
