import { useMemo } from 'react';
import { useKubeQuery } from './useKubeQuery';
import {
  type ServiceData,
  type ServiceEndpointSlice,
  type ServiceEndpoint
} from '../types/ServiceData';
import { type K8sResource } from '../types/K8sResource';
import { formatAge } from '../utils/formatAge';

interface ServicesExtraData {
  endpoints?: K8sResource[];
  endpointSlices?: K8sResource[];
}

interface LoadBalancerIngress {
  ip?: string;
  hostname?: string;
}

interface EndpointAddress {
  ip: string;
}

interface EndpointSubsetPort {
  port: number;
}

interface EndpointSubset {
  addresses?: EndpointAddress[];
  ports?: EndpointSubsetPort[];
}

interface EndpointItem {
  metadata?: K8sResource['metadata'];
  subsets?: EndpointSubset[];
}

interface EndpointSliceItem {
  metadata?: K8sResource['metadata'];
  addressType?: string;
  endpoints?: Array<{
    conditions?: {
      ready?: boolean;
    };
  }>;
  ports?: Array<{
    port: number;
    protocol: string;
  }>;
}

interface ServiceResource {
  metadata?: {
    name?: string;
    namespace?: string;
    creationTimestamp?: string;
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
    finalizers?: string[];
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
      ingress?: LoadBalancerIngress[];
    };
  };
}

export function useServices(enabled: boolean) {
  const transform = useMemo(
    () => (items: K8sResource[], extraData?: unknown) => {
      const extra = (extraData as ServicesExtraData) || { endpoints: [], endpointSlices: [] };

      return items.map((item) => {
        const svcItem = item as unknown as ServiceResource;
        const serviceName = svcItem.metadata?.name || '';
        const ns = svcItem.metadata?.namespace || '';

        // Ports formatting: port:nodePort/protocol or port:targetPort/protocol if nodePort/targetPort exists
        const portsList = (svcItem.spec?.ports || []).map((p) => {
          let portStr = `${p.port}`;
          if (p.nodePort) {
            portStr += `:${p.nodePort}`;
          } else if (p.targetPort && String(p.targetPort) !== String(p.port)) {
            portStr += `:${p.targetPort}`;
          }
          return `${portStr}/${p.protocol}`;
        });
        const ports = portsList.join(', ');

        // External IPs
        let externalIps = '—';
        const loadBalancerIngress = svcItem.status?.loadBalancer?.ingress || [];
        if (loadBalancerIngress.length > 0) {
          externalIps = loadBalancerIngress
            .map((i) => i.ip || i.hostname || '')
            .filter(Boolean)
            .join(', ');
          if (!externalIps) externalIps = '—';
        } else if (svcItem.spec?.externalIPs && svcItem.spec.externalIPs.length > 0) {
          externalIps = svcItem.spec.externalIPs.join(', ');
        }

        // Selector string representation
        const selectorObj = svcItem.spec?.selector || {};
        const selectorStr = Object.entries(selectorObj)
          .map(([k, v]) => `${k}=${v}`)
          .join(', ');

        // Find matching endpoints
        const matchedEndpointsObj = (extra.endpoints || []).find(
          (ep: K8sResource) => ep.metadata?.name === serviceName && ep.metadata?.namespace === ns
        ) as EndpointItem | undefined;

        const endpointsList: ServiceEndpoint[] = [];
        if (matchedEndpointsObj) {
          const subsets = matchedEndpointsObj.subsets || [];
          const ips: string[] = [];
          subsets.forEach((sub) => {
            const subPorts = sub.ports || [];
            const addrs = sub.addresses || [];
            addrs.forEach((addr) => {
              if (subPorts.length > 0) {
                subPorts.forEach((p) => {
                  ips.push(`${addr.ip}:${p.port}`);
                });
              } else {
                ips.push(addr.ip);
              }
            });
          });
          if (ips.length > 0) {
            endpointsList.push({
              name: serviceName,
              endpoints: ips.join(', ')
            });
          }
        }

        // Find matching endpointSlices
        const matchedSlices = (
          (extra.endpointSlices || []) as unknown as EndpointSliceItem[]
        ).filter(
          (es) =>
            es.metadata?.namespace === ns &&
            es.metadata?.labels?.['kubernetes.io/service-name'] === serviceName
        );

        const endpointSlicesList: ServiceEndpointSlice[] = matchedSlices.map((slice) => {
          const endpointsArr = slice.endpoints || [];
          const total = endpointsArr.length;
          const ready = endpointsArr.filter((e) => e.conditions?.ready).length;
          const endpointsCount = `${ready}/${total}`;

          const addressType = slice.addressType || 'IPv4';
          const slicePorts =
            (slice.ports || []).map((p) => `${p.port}/${p.protocol}`).join(', ') || '—';

          return {
            name: slice.metadata?.name || '',
            endpointsCount,
            ports: slicePorts,
            addressType,
            age: formatAge(slice.metadata?.creationTimestamp || ''),
            creationTimestamp: slice.metadata?.creationTimestamp || ''
          };
        });

        // Warnings check: selector exists but no endpoints
        const hasWarning = Object.keys(selectorObj).length > 0 && endpointsList.length === 0;

        const creationTimestamp = svcItem.metadata?.creationTimestamp || '';

        return {
          id: `${ns}/${serviceName}`,
          name: serviceName,
          ns,
          type: svcItem.spec?.type || 'ClusterIP',
          clusterIp: svcItem.spec?.clusterIP || '—',
          clusterIps: svcItem.spec?.clusterIPs || [],
          ipFamilies: svcItem.spec?.ipFamilies || [],
          ipFamilyPolicy: svcItem.spec?.ipFamilyPolicy || '—',
          externalIps,
          selector: selectorObj,
          selectorStr,
          ports,
          sessionAffinity: svcItem.spec?.sessionAffinity || 'None',
          age: formatAge(creationTimestamp),
          createdTime: creationTimestamp ? new Date(creationTimestamp).toLocaleString() : '',
          annotations: svcItem.metadata?.annotations,
          finalizers: svcItem.metadata?.finalizers,
          status: 'Active',
          hasWarning,
          endpointSlices: endpointSlicesList,
          endpoints: endpointsList
        };
      });
    },
    []
  );

  const fetchExtraData = useMemo(
    () => async (configPath: string | undefined, cluster: string, ns: string) => {
      try {
        const [endpointsRes, endpointSlicesRes] = await Promise.all([
          window.kuberneter.getResources(configPath, cluster, 'endpoints', ns),
          window.kuberneter.getResources(configPath, cluster, 'endpointslices', ns)
        ]);
        return {
          endpoints: endpointsRes?.items || [],
          endpointSlices: endpointSlicesRes?.items || []
        };
      } catch (e) {
        console.warn('Failed to fetch services extra data', e);
        return { endpoints: [], endpointSlices: [] };
      }
    },
    []
  );

  return useKubeQuery<ServiceData>('services', transform, enabled, fetchExtraData);
}
