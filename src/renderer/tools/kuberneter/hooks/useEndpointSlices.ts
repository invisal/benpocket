import { useMemo } from 'react';
import { useKubeQuery } from './useKubeQuery';
import {
  type EndpointSliceData,
  type EndpointSliceEndpoint,
  type EndpointSlicePort
} from '../types/EndpointSliceData';
import { type K8sResource } from '../types/K8sResource';
import { formatAge } from '../utils/formatAge';

interface RawEndpointSliceEndpoint {
  addresses?: string[];
  conditions?: {
    ready?: boolean;
    serving?: boolean;
    terminating?: boolean;
  };
  targetRef?: {
    kind?: string;
    name?: string;
    namespace?: string;
  };
  nodeName?: string;
  zone?: string;
}

interface RawEndpointSlicePort {
  name?: string;
  port?: number;
  protocol?: string;
  appProtocol?: string;
}

interface EndpointSliceResource {
  metadata?: {
    name?: string;
    namespace?: string;
    creationTimestamp?: string;
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
    ownerReferences?: Array<{
      kind: string;
      name: string;
      controller?: boolean;
    }>;
  };
  addressType?: string;
  endpoints?: RawEndpointSliceEndpoint[];
  ports?: RawEndpointSlicePort[];
}

export function useEndpointSlices(enabled: boolean) {
  const transform = useMemo(
    () => (items: K8sResource[]) => {
      return items.map((item) => {
        const sliceItem = item as unknown as EndpointSliceResource;
        const name = sliceItem.metadata?.name || '';
        const ns = sliceItem.metadata?.namespace || '';
        const addressType = sliceItem.addressType || 'IPv4';

        const rawEndpoints = sliceItem.endpoints || [];
        const rawPorts = sliceItem.ports || [];

        // Format endpointsStr (e.g. 10.244.1.4:4000, 10.244.1.2:4000)
        const endpointsList: string[] = [];
        rawEndpoints.forEach((ep) => {
          const addrs = ep.addresses || [];
          addrs.forEach((addr) => {
            if (rawPorts.length > 0) {
              rawPorts.forEach((p) => {
                if (p.port) {
                  endpointsList.push(`${addr}:${p.port}`);
                } else {
                  endpointsList.push(addr);
                }
              });
            } else {
              endpointsList.push(addr);
            }
          });
        });
        const endpointsStr = endpointsList.join(', ') || '—';

        // Format portsStr (e.g. 4000/TCP)
        const portsStr =
          rawPorts
            .map((p) => {
              const parts: string[] = [];
              if (p.port) parts.push(String(p.port));
              if (p.protocol) parts.push(p.protocol);
              return parts.join('/');
            })
            .join(', ') || '—';

        // Controlled By / Owner Reference
        const ownerRef = sliceItem.metadata?.ownerReferences?.find((o) => o.controller);
        const controlledByName = ownerRef?.name;
        const controlledByKind = ownerRef?.kind;

        const endpoints: EndpointSliceEndpoint[] = rawEndpoints.map((ep) => ({
          addresses: ep.addresses || [],
          ready: ep.conditions?.ready,
          targetRefName: ep.targetRef?.name,
          targetRefNamespace: ep.targetRef?.namespace,
          targetRefKind: ep.targetRef?.kind,
          nodeName: ep.nodeName,
          zone: ep.zone || '-'
        }));

        const ports: EndpointSlicePort[] = rawPorts.map((p) => ({
          name: p.name || '—',
          port: p.port,
          protocol: p.protocol,
          appProtocol: p.appProtocol || '—'
        }));

        const creationTimestamp = sliceItem.metadata?.creationTimestamp || '';

        return {
          id: `${ns}/${name}`,
          name,
          ns,
          addressType,
          endpoints,
          endpointsStr,
          ports,
          portsStr,
          age: formatAge(creationTimestamp),
          createdTime: creationTimestamp ? new Date(creationTimestamp).toLocaleString() : '',
          labels: sliceItem.metadata?.labels,
          annotations: sliceItem.metadata?.annotations,
          controlledByName,
          controlledByKind,
          rawItem: sliceItem
        };
      });
    },
    []
  );

  return useKubeQuery<EndpointSliceData>('endpointslices', transform, enabled);
}
