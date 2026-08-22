import { formatAge } from '../../../utils/formatAge';
import {
  type ServiceData,
  type ServiceEndpoint,
  type ServiceEndpointSlice
} from '../../../types/ServiceData';
import {
  type EndpointSliceData,
  type EndpointSliceEndpoint,
  type EndpointSlicePort
} from '../../../types/EndpointSliceData';
import {
  type EndpointData,
  type EndpointSubset,
  type EndpointAddress,
  type EndpointPort
} from '../../../types/EndpointData';
import { type IngressData, type IngressRuleData } from '../../../types/IngressData';
import { type IngressClassData } from '../../../types/IngressClassData';
import {
  type NetworkPolicyData,
  type RuleData,
  type PeerData
} from '../../../types/NetworkPolicyData';
import { type PortForwardData } from '../../../types/PortForwardData';
import { type K8sResource } from '../../../types/K8sResource';

export function buildServiceDetailPayload(
  name: string,
  namespace: string,
  rawResource?: K8sResource,
  epRes?: K8sResource[],
  epsRes?: K8sResource[]
): ServiceData {
  const svcItem = rawResource as unknown as {
    metadata?: {
      name?: string;
      namespace?: string;
      creationTimestamp?: string;
      labels?: Record<string, string>;
      annotations?: Record<string, string>;
      finalizers?: string[];
      ownerReferences?: Array<{ kind?: string; name?: string }>;
    };
    spec?: {
      type?: string;
      clusterIP?: string;
      clusterIPs?: string[];
      ipFamilies?: string[];
      ipFamilyPolicy?: string;
      externalIPs?: string[];
      selector?: Record<string, string>;
      sessionAffinity?: string;
      ports?: Array<{
        port: number;
        protocol: string;
        nodePort?: number;
        targetPort?: number | string;
      }>;
    };
    status?: {
      loadBalancer?: {
        ingress?: Array<{ ip?: string; hostname?: string }>;
      };
    };
  };

  const portsList = (svcItem?.spec?.ports || []).map((p) => {
    let portStr = `${p.port}`;
    if (p.nodePort) {
      portStr += `:${p.nodePort}`;
    } else if (p.targetPort && String(p.targetPort) !== String(p.port)) {
      portStr += `:${p.targetPort}`;
    }
    return `${portStr}/${p.protocol}`;
  });
  const ports = portsList.join(', ');

  let externalIps = '—';
  const loadBalancerIngress = svcItem?.status?.loadBalancer?.ingress || [];
  if (loadBalancerIngress.length > 0) {
    externalIps = loadBalancerIngress
      .map((i) => i.ip || i.hostname || '')
      .filter(Boolean)
      .join(', ');
    if (!externalIps) externalIps = '—';
  } else if (svcItem?.spec?.externalIPs && svcItem.spec.externalIPs.length > 0) {
    externalIps = svcItem.spec.externalIPs.join(', ');
  }

  const selectorObj = svcItem?.spec?.selector || {};
  const selectorStr = Object.entries(selectorObj)
    .map(([k, v]) => `${k}=${v}`)
    .join(', ');

  const endpointsList: ServiceEndpoint[] = [];
  if (epRes && epRes.length > 0) {
    const matchedEndpointsObj = epRes.find(
      (ep) => ep.metadata?.name === name && ep.metadata?.namespace === namespace
    ) as
      | {
          subsets?: Array<{
            addresses?: Array<{ ip: string }>;
            ports?: Array<{ port: number }>;
          }>;
        }
      | undefined;

    if (matchedEndpointsObj?.subsets) {
      const ips: string[] = [];
      matchedEndpointsObj.subsets.forEach((sub) => {
        const subPorts = sub.ports || [];
        const addrs = sub.addresses || [];
        addrs.forEach((addr) => {
          if (subPorts.length > 0) {
            subPorts.forEach((p) => ips.push(`${addr.ip}:${p.port}`));
          } else {
            ips.push(addr.ip);
          }
        });
      });
      if (ips.length > 0) {
        endpointsList.push({ name, endpoints: ips.join(', ') });
      }
    }
  }

  const endpointSlicesList: ServiceEndpointSlice[] = [];
  if (epsRes && epsRes.length > 0) {
    const matchedSlices = epsRes.filter(
      (es) =>
        es.metadata?.namespace === namespace &&
        es.metadata?.labels?.['kubernetes.io/service-name'] === name
    ) as unknown as Array<{
      metadata?: K8sResource['metadata'];
      addressType?: string;
      endpoints?: Array<{ conditions?: { ready?: boolean } }>;
      ports?: Array<{ port: number; protocol: string }>;
    }>;

    matchedSlices.forEach((slice) => {
      const endpointsArr = slice.endpoints || [];
      const total = endpointsArr.length;
      const ready = endpointsArr.filter((e) => e.conditions?.ready).length;
      const endpointsCount = `${ready}/${total}`;
      const addressType = slice.addressType || 'IPv4';
      const slicePorts =
        (slice.ports || []).map((p) => `${p.port}/${p.protocol}`).join(', ') || '—';
      endpointSlicesList.push({
        name: slice.metadata?.name || '',
        endpointsCount,
        ports: slicePorts,
        addressType,
        age: formatAge(slice.metadata?.creationTimestamp || ''),
        creationTimestamp: slice.metadata?.creationTimestamp || ''
      });
    });
  }

  const owner = svcItem?.metadata?.ownerReferences?.[0];
  const creationTimestamp = svcItem?.metadata?.creationTimestamp || '';

  return {
    id: `${namespace}/${name}`,
    name,
    ns: namespace,
    type: svcItem?.spec?.type || 'ClusterIP',
    clusterIp: svcItem?.spec?.clusterIP || '—',
    clusterIps: svcItem?.spec?.clusterIPs || [],
    ipFamilies: svcItem?.spec?.ipFamilies || [],
    ipFamilyPolicy: svcItem?.spec?.ipFamilyPolicy || '—',
    externalIps,
    selector: selectorObj,
    selectorStr,
    ports,
    sessionAffinity: svcItem?.spec?.sessionAffinity || 'None',
    age: formatAge(creationTimestamp),
    createdTime: creationTimestamp ? new Date(creationTimestamp).toLocaleString() : '',
    labels: svcItem?.metadata?.labels,
    annotations: svcItem?.metadata?.annotations,
    finalizers: svcItem?.metadata?.finalizers,
    controlledByName: owner?.name,
    controlledByKind: owner?.kind,
    status: 'Active',
    hasWarning: Object.keys(selectorObj).length > 0 && endpointsList.length === 0,
    endpointSlices: endpointSlicesList,
    endpoints: endpointsList,
    rawItem: rawResource
  };
}

export function buildEndpointSliceDetailPayload(
  name: string,
  namespace: string,
  rawResource?: K8sResource
): EndpointSliceData {
  const rawSlice = rawResource as unknown as {
    metadata?: {
      name?: string;
      namespace?: string;
      creationTimestamp?: string;
      labels?: Record<string, string>;
      annotations?: Record<string, string>;
      ownerReferences?: Array<{ kind?: string; name?: string }>;
    };
    addressType?: string;
    endpoints?: Array<{
      addresses?: string[];
      conditions?: { ready?: boolean };
      targetRef?: { kind?: string; namespace?: string; name?: string };
      nodeName?: string;
      zone?: string;
    }>;
    ports?: Array<{
      name?: string;
      port?: number;
      protocol?: string;
      appProtocol?: string;
    }>;
  };

  const creationTimestamp = rawSlice?.metadata?.creationTimestamp || '';
  const endpointsList: EndpointSliceEndpoint[] = (rawSlice?.endpoints || []).map((e) => ({
    addresses: e.addresses || [],
    ready: e.conditions?.ready,
    targetRefName: e.targetRef?.name,
    targetRefNamespace: e.targetRef?.namespace,
    targetRefKind: e.targetRef?.kind,
    nodeName: e.nodeName,
    zone: e.zone
  }));

  const portsList: EndpointSlicePort[] = (rawSlice?.ports || []).map((p) => ({
    name: p.name,
    port: p.port,
    protocol: p.protocol,
    appProtocol: p.appProtocol
  }));

  const endpointsSummary = endpointsList
    .map((e) => e.addresses.join(', '))
    .filter(Boolean)
    .join(', ');

  const portsSummary = portsList
    .map((p) => (p.port ? `${p.port}/${p.protocol || 'TCP'}` : '—'))
    .join(', ');

  const owner = rawSlice?.metadata?.ownerReferences?.[0];
  const serviceName = rawSlice?.metadata?.labels?.['kubernetes.io/service-name'];

  return {
    id: `${namespace}/${name}`,
    name,
    ns: namespace,
    addressType: rawSlice?.addressType || 'IPv4',
    endpoints: endpointsList,
    endpointsStr: endpointsSummary || '—',
    ports: portsList,
    portsStr: portsSummary || '—',
    age: formatAge(creationTimestamp),
    createdTime: creationTimestamp ? new Date(creationTimestamp).toLocaleString() : '',
    creationTimestamp,
    labels: rawSlice?.metadata?.labels,
    annotations: rawSlice?.metadata?.annotations,
    controlledByName: owner?.name || serviceName,
    controlledByKind: owner?.kind || (serviceName ? 'Service' : undefined),
    rawItem: rawResource
  };
}

export function buildEndpointDetailPayload(
  name: string,
  namespace: string,
  rawResource?: K8sResource
): EndpointData {
  const rawEp = rawResource as unknown as {
    metadata?: {
      name?: string;
      namespace?: string;
      creationTimestamp?: string;
      labels?: Record<string, string>;
      annotations?: Record<string, string>;
    };
    subsets?: Array<{
      addresses?: Array<{
        ip: string;
        hostname?: string;
        targetRef?: { kind?: string; namespace?: string; name?: string };
        nodeName?: string;
      }>;
      notReadyAddresses?: Array<{
        ip: string;
        hostname?: string;
        targetRef?: { kind?: string; namespace?: string; name?: string };
        nodeName?: string;
      }>;
      ports?: Array<{
        name?: string;
        port?: number;
        protocol?: string;
      }>;
    }>;
  };

  const creationTimestamp = rawEp?.metadata?.creationTimestamp || '';

  const subsets: EndpointSubset[] = (rawEp?.subsets || []).map((sub) => {
    const addresses: EndpointAddress[] = (sub.addresses || []).map((a) => ({
      ip: a.ip,
      hostname: a.hostname,
      targetRefName: a.targetRef?.name,
      targetRefNamespace: a.targetRef?.namespace,
      targetRefKind: a.targetRef?.kind,
      nodeName: a.nodeName
    }));

    const notReadyAddresses: EndpointAddress[] = (sub.notReadyAddresses || []).map((a) => ({
      ip: a.ip,
      hostname: a.hostname,
      targetRefName: a.targetRef?.name,
      targetRefNamespace: a.targetRef?.namespace,
      targetRefKind: a.targetRef?.kind,
      nodeName: a.nodeName
    }));

    const ports: EndpointPort[] = (sub.ports || []).map((p) => ({
      name: p.name,
      port: p.port,
      protocol: p.protocol
    }));

    return { addresses, notReadyAddresses, ports };
  });

  const allIps: string[] = [];
  subsets.forEach((s) => {
    (s.addresses || []).forEach((a) => {
      if (s.ports && s.ports.length > 0) {
        s.ports.forEach((p) => allIps.push(`${a.ip}:${p.port}`));
      } else {
        allIps.push(a.ip);
      }
    });
  });

  return {
    id: `${namespace}/${name}`,
    name,
    ns: namespace,
    endpointsStr: allIps.join(', ') || '—',
    subsets,
    age: formatAge(creationTimestamp),
    createdTime: creationTimestamp ? new Date(creationTimestamp).toLocaleString() : '',
    creationTimestamp,
    labels: rawEp?.metadata?.labels,
    annotations: rawEp?.metadata?.annotations,
    rawItem: rawResource
  };
}

export function buildIngressDetailPayload(
  name: string,
  namespace: string,
  rawResource?: K8sResource
): IngressData {
  const rawIng = rawResource as unknown as {
    metadata?: {
      name?: string;
      namespace?: string;
      creationTimestamp?: string;
      labels?: Record<string, string>;
      annotations?: Record<string, string>;
    };
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
      tls?: Array<{
        hosts?: string[];
        secretName?: string;
      }>;
      defaultBackend?: {
        service?: { name?: string; port?: { number?: number; name?: string } };
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
    creationTimestamp,
    labels: rawResource?.metadata?.labels,
    annotations: rawResource?.metadata?.annotations,
    rawItem: rawResource
  };
}

export function buildIngressClassDetailPayload(
  name: string,
  rawResource?: K8sResource
): IngressClassData {
  const rawIc = rawResource as unknown as {
    metadata?: {
      name?: string;
      creationTimestamp?: string;
      annotations?: Record<string, string>;
    };
    spec?: {
      controller?: string;
      parameters?: {
        name?: string;
        scope?: string;
        kind?: string;
        apiGroup?: string;
      };
    };
  };

  const annotations = rawIc?.metadata?.annotations || {};
  const isDefault = annotations['ingressclass.kubernetes.io/is-default-class'] === 'true';
  const creationTimestamp = rawIc?.metadata?.creationTimestamp || '';

  return {
    id: name,
    name,
    isDefault,
    controller: rawIc?.spec?.controller || '—',
    parametersName: rawIc?.spec?.parameters?.name || '',
    parametersScope: rawIc?.spec?.parameters?.scope || '',
    parametersKind: rawIc?.spec?.parameters?.kind || '',
    parametersApiGroup: rawIc?.spec?.parameters?.apiGroup || '',
    age: formatAge(creationTimestamp),
    createdTime: creationTimestamp ? new Date(creationTimestamp).toLocaleString() : '',
    creationTimestamp,
    annotations: rawIc?.metadata?.annotations,
    rawItem: rawResource
  };
}

export function buildNetworkPolicyDetailPayload(
  name: string,
  namespace: string,
  rawResource?: K8sResource
): NetworkPolicyData {
  const rawNp = rawResource as unknown as {
    metadata?: {
      name?: string;
      namespace?: string;
      creationTimestamp?: string;
      labels?: Record<string, string>;
      annotations?: Record<string, string>;
    };
    spec?: {
      podSelector?: {
        matchLabels?: Record<string, string>;
        matchExpressions?: Array<{ key: string; operator: string; values?: string[] }>;
      };
      policyTypes?: string[];
      ingress?: Array<{
        ports?: Array<{ port?: number | string; protocol?: string }>;
        from?: Array<{
          ipBlock?: { cidr: string; except?: string[] };
          namespaceSelector?: { matchLabels?: Record<string, string> };
          podSelector?: { matchLabels?: Record<string, string> };
        }>;
      }>;
      egress?: Array<{
        ports?: Array<{ port?: number | string; protocol?: string }>;
        to?: Array<{
          ipBlock?: { cidr: string; except?: string[] };
          namespaceSelector?: { matchLabels?: Record<string, string> };
          podSelector?: { matchLabels?: Record<string, string> };
        }>;
      }>;
    };
  };

  const creationTimestamp = rawNp?.metadata?.creationTimestamp || '';
  const policyTypes = rawNp?.spec?.policyTypes || ['Ingress'];

  const podMatchLabels = rawNp?.spec?.podSelector?.matchLabels || {};
  const podSelectorStr = Object.entries(podMatchLabels)
    .map(([k, v]) => `${k}=${v}`)
    .join(', ');

  const parsePeers = (
    peersArr?: Array<{
      ipBlock?: { cidr: string; except?: string[] };
      namespaceSelector?: { matchLabels?: Record<string, string> };
      podSelector?: { matchLabels?: Record<string, string> };
    }>
  ): PeerData[] => {
    if (!peersArr) return [];
    return peersArr.map((peer) => {
      const nsLabels = peer.namespaceSelector?.matchLabels || {};
      const nsStr = Object.entries(nsLabels)
        .map(([k, v]) => `${k}=${v}`)
        .join(', ');
      const podLabels = peer.podSelector?.matchLabels || {};
      const podStr = Object.entries(podLabels)
        .map(([k, v]) => `${k}=${v}`)
        .join(', ');

      return {
        ipBlock: peer.ipBlock,
        namespaceSelector: nsStr || undefined,
        podSelector: podStr || undefined
      };
    });
  };

  const parsePorts = (
    portsArr?: Array<{ port?: number | string; protocol?: string }>
  ): string[] => {
    if (!portsArr || portsArr.length === 0) return [];
    return portsArr.map((p) => `${p.port || 'All'}/${p.protocol || 'TCP'}`);
  };

  const ingressRules: RuleData[] = (rawNp?.spec?.ingress || []).map((rule) => ({
    ports: parsePorts(rule.ports),
    peers: parsePeers(rule.from)
  }));

  const egressRules: RuleData[] = (rawNp?.spec?.egress || []).map((rule) => ({
    ports: parsePorts(rule.ports),
    peers: parsePeers(rule.to)
  }));

  return {
    id: `${namespace}/${name}`,
    name,
    ns: namespace,
    policyTypes,
    policyTypesStr: policyTypes.join(', '),
    podSelectorStr: podSelectorStr || '{}',
    ingressRules,
    egressRules,
    hasWarning: false,
    age: formatAge(creationTimestamp),
    createdTime: creationTimestamp ? new Date(creationTimestamp).toLocaleString() : '',
    creationTimestamp,
    labels: rawNp?.metadata?.labels,
    annotations: rawNp?.metadata?.annotations,
    rawItem: rawResource
  };
}

export function buildPortForwardDetailPayload(portForward: PortForwardData): PortForwardData {
  return {
    id: portForward.id,
    name: portForward.name,
    ns: portForward.ns,
    kind: portForward.kind,
    podPort: portForward.podPort,
    localPort: portForward.localPort,
    protocol: portForward.protocol,
    status: portForward.status,
    url: portForward.url,
    pid: portForward.pid
  };
}
