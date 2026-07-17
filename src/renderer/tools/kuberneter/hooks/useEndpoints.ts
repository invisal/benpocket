import { useMemo } from 'react';
import { useKubeQuery } from './useKubeQuery';
import { type EndpointData, type EndpointSubset } from '../types/EndpointData';
import { type K8sResource } from '../types/K8sResource';
import { formatAge } from '../utils/formatAge';

interface EndpointK8sResource extends K8sResource {
  subsets?: EndpointSubset[];
}

export function useEndpoints(enabled: boolean) {
  const transform = useMemo(
    () => (items: K8sResource[]) => {
      return items.map((item) => {
        const epItem = item as unknown as EndpointK8sResource;
        const name = epItem.metadata?.name || '';
        const ns = epItem.metadata?.namespace || '';
        const creationTimestamp = epItem.metadata?.creationTimestamp || '';

        const subsets = epItem.subsets || [];
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

        const endpointsStr = ips.join(', ') || '—';

        // Map subsets targets properly
        const formattedSubsets = subsets.map((sub) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const addresses = (sub.addresses || []).map((addr: any) => ({
            ip: addr.ip,
            hostname: addr.hostname,
            targetRefName: addr.targetRef?.name,
            targetRefNamespace: addr.targetRef?.namespace,
            targetRefKind: addr.targetRef?.kind,
            nodeName: addr.nodeName
          }));

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const notReadyAddresses = (sub.notReadyAddresses || []).map((addr: any) => ({
            ip: addr.ip,
            hostname: addr.hostname,
            targetRefName: addr.targetRef?.name,
            targetRefNamespace: addr.targetRef?.namespace,
            targetRefKind: addr.targetRef?.kind,
            nodeName: addr.nodeName
          }));

          const ports = (sub.ports || []).map((p) => ({
            name: p.name,
            port: p.port,
            protocol: p.protocol
          }));

          return {
            addresses,
            notReadyAddresses,
            ports
          };
        });

        return {
          id: `${ns}/${name}`,
          name,
          ns,
          endpointsStr,
          subsets: formattedSubsets,
          age: formatAge(creationTimestamp),
          createdTime: creationTimestamp ? new Date(creationTimestamp).toLocaleString() : '',
          labels: epItem.metadata?.labels,
          annotations: epItem.metadata?.annotations,
          rawItem: epItem
        };
      });
    },
    []
  );

  return useKubeQuery<EndpointData>('endpoints', transform, enabled);
}
