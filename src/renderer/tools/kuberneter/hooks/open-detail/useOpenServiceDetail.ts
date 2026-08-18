import { useCallback } from 'react';
import { useDetailTabOpener } from './core/useDetailTabOpener';
import { useKuberneterStore } from '../../store/kuberneter.store';
import { formatAge } from '../../utils/formatAge';
import {
  type ServiceData,
  type ServiceEndpoint,
  type ServiceEndpointSlice
} from '../../types/ServiceData';
import { type K8sResource } from '../../types/K8sResource';
import { K8S_RESOURCE_KEYS } from '../../constants/k8sResources';

interface RawServiceResource {
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
      ingress?: Array<{ ip?: string; hostname?: string }>;
    };
  };
}

export function useOpenServiceDetail() {
  const { openDetailTab, activeInstanceId } = useDetailTabOpener();
  const cluster = useKuberneterStore((s) => s.kuberneterInstanceCluster[activeInstanceId] || '');
  const rawConfigPath = useKuberneterStore(
    (s) => s.kuberneterInstanceConfigPath[activeInstanceId] || 'default'
  );

  const openServiceDetail = useCallback(
    async (namespace: string, serviceName: string) => {
      if (!serviceName) return;

      let targetNamespace = namespace;

      let payload: ServiceData = {
        id: `${targetNamespace}/${serviceName}`,
        name: serviceName,
        ns: targetNamespace,
        type: 'ClusterIP',
        clusterIp: '—',
        clusterIps: [],
        ipFamilies: [],
        ipFamilyPolicy: '—',
        externalIps: '—',
        selector: {},
        selectorStr: '',
        ports: '',
        sessionAffinity: 'None',
        age: '—',
        createdTime: '',
        status: 'Active',
        hasWarning: false,
        endpointSlices: [],
        endpoints: []
      };

      try {
        const configPathArg = rawConfigPath === 'default' ? undefined : rawConfigPath;
        const [svcRes, epRes, epsRes] = await Promise.all([
          window.kuberneter.getResources(
            configPathArg,
            cluster,
            K8S_RESOURCE_KEYS.SERVICES,
            targetNamespace
          ),
          window.kuberneter
            .getResources(configPathArg, cluster, K8S_RESOURCE_KEYS.ENDPOINTS, targetNamespace)
            .catch(() => ({ items: [] })),
          window.kuberneter
            .getResources(
              configPathArg,
              cluster,
              K8S_RESOURCE_KEYS.ENDPOINT_SLICES,
              targetNamespace
            )
            .catch(() => ({ items: [] }))
        ]);

        const rawItems = (svcRes?.items || []) as unknown as RawServiceResource[];
        let svcItem = rawItems.find((i) => i.metadata?.name === serviceName);

        // If not found in the initial namespace, fallback to searching all namespaces
        if (!svcItem) {
          try {
            const allSvcRes = await window.kuberneter.getResources(
              configPathArg,
              cluster,
              K8S_RESOURCE_KEYS.SERVICES
            );
            const allItems = (allSvcRes?.items || []) as unknown as RawServiceResource[];
            const found = allItems.find((i) => i.metadata?.name === serviceName);
            if (found && found.metadata?.namespace) {
              svcItem = found;
              targetNamespace = found.metadata.namespace;
            }
          } catch {
            // Ignore fallback error
          }
        }

        if (svcItem) {
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

          const selectorObj = svcItem.spec?.selector || {};
          const selectorStr = Object.entries(selectorObj)
            .map(([k, v]) => `${k}=${v}`)
            .join(', ');

          const endpoints = (epRes?.items || []) as K8sResource[];
          const matchedEndpointsObj = endpoints.find(
            (ep) => ep.metadata?.name === serviceName && ep.metadata?.namespace === targetNamespace
          ) as
            | {
                subsets?: Array<{
                  addresses?: Array<{ ip: string }>;
                  ports?: Array<{ port: number }>;
                }>;
              }
            | undefined;

          const endpointsList: ServiceEndpoint[] = [];
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
              endpointsList.push({ name: serviceName, endpoints: ips.join(', ') });
            }
          }

          const endpointSlices = (epsRes?.items || []) as K8sResource[];
          const matchedSlices = endpointSlices.filter(
            (es) =>
              es.metadata?.namespace === targetNamespace &&
              es.metadata?.labels?.['kubernetes.io/service-name'] === serviceName
          ) as unknown as Array<{
            metadata?: K8sResource['metadata'];
            addressType?: string;
            endpoints?: Array<{ conditions?: { ready?: boolean } }>;
            ports?: Array<{ port: number; protocol: string }>;
          }>;

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

          const creationTimestamp = svcItem.metadata?.creationTimestamp || '';

          payload = {
            id: `${targetNamespace}/${serviceName}`,
            name: serviceName,
            ns: targetNamespace,
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
            hasWarning: Object.keys(selectorObj).length > 0 && endpointsList.length === 0,
            endpointSlices: endpointSlicesList,
            endpoints: endpointsList
          };
        }
      } catch (err) {
        console.warn('Failed to fetch service detail payload:', err);
      }

      openDetailTab({
        contentType: 'service',
        resourceTab: 'service-detail',
        name: serviceName,
        namespace: targetNamespace,
        title: `Service: ${serviceName}`,
        payload
      });
    },
    [openDetailTab, cluster, rawConfigPath]
  );

  return { openServiceDetail };
}
