import { Age } from '../../Age';
import type React from 'react';
import {
  type ServiceData,
  type ServiceEndpointSlice,
  type ServiceEndpoint
} from '../../../types/ServiceData';
import { useLayoutStore } from '../../../../../src/store/layout.store';
import { useKuberneterStore } from '../../../store/kuberneter.store';
import { KubeTable } from '../../kubeTable';
import { KubePropertiesTable, type PropertyItem } from './KubePropertiesTable';

interface ServiceDetailProps {
  payload: ServiceData;
  isTab?: boolean;
}

export const ServiceDetail: React.FC<ServiceDetailProps> = ({ payload, isTab = false }) => {
  const activeInstanceId = useLayoutStore((s) => s.activeInstanceId);
  const setNamespace = useKuberneterStore((s) => s.setKuberneterInstanceNamespace);

  if (!payload) {
    return <div className="p-4 text-xs text-zinc-500">No Service details available.</div>;
  }

  const handleNamespaceClick = () => {
    if (payload.ns && activeInstanceId) {
      setNamespace(activeInstanceId, payload.ns);
    }
  };

  const annotations = payload.annotations ? Object.entries(payload.annotations) : [];
  const labels = payload.labels ? Object.entries(payload.labels) : [];
  const selectors = payload.selector ? Object.entries(payload.selector) : [];
  const finalizers = payload.finalizers || [];

  const propertiesData: PropertyItem[] = [
    {
      id: 'created',
      name: 'Created',
      value: (
        <span>
          <Age
            timestamp={(payload as unknown as Record<string, unknown>).creationTimestamp as string}
          />{' '}
          ago ({((payload as unknown as Record<string, unknown>).createdTime as string) || 'N/A'})
        </span>
      )
    },
    {
      id: 'name',
      name: 'Name',
      value: payload.name
    },
    {
      id: 'namespace',
      name: 'Namespace',
      value: (
        <span
          onClick={handleNamespaceClick}
          className="font-mono text-accent hover:underline cursor-pointer"
        >
          {payload.ns}
        </span>
      )
    },
    {
      id: 'labels',
      name: 'Labels',
      value: `${labels.length} Labels`,
      hasDetail: labels.length > 0,
      renderDetail: () => (
        <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto pr-1 select-text">
          {labels.map(([k, v]) => (
            <span
              key={k}
              className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-surface-3 border border-border/60 text-zinc-350 truncate max-w-full"
              title={`${k}=${v}`}
            >
              {k}={v}
            </span>
          ))}
        </div>
      )
    },
    {
      id: 'annotations',
      name: 'Annotations',
      value: `${annotations.length} Annotations`,
      hasDetail: annotations.length > 0,
      renderDetail: () => (
        <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto pr-1 select-text">
          {annotations.map(([k, v]) => (
            <span
              key={k}
              className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-surface-3 border border-border/60 text-zinc-350 truncate max-w-full"
              title={`${k}=${v}`}
            >
              {k}={v}
            </span>
          ))}
        </div>
      )
    }
  ];

  if (payload.controlledByName) {
    propertiesData.push({
      id: 'controlledBy',
      name: 'Controlled By',
      value: (
        <span>
          {payload.controlledByKind || 'Owner'}{' '}
          <span className="text-zinc-300 font-mono">{payload.controlledByName}</span>
        </span>
      )
    });
  }

  if (selectors.length > 0) {
    propertiesData.push({
      id: 'selector',
      name: 'Selector',
      value: `${selectors.length} Selectors`,
      hasDetail: true,
      renderDetail: () => (
        <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto pr-1 select-text">
          {selectors.map(([k, v]) => (
            <span
              key={k}
              className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-surface-3 border border-border/60 text-zinc-350 truncate max-w-full"
              title={`${k}=${v}`}
            >
              {k}={v}
            </span>
          ))}
        </div>
      )
    });
  }

  if (finalizers.length > 0) {
    propertiesData.push({
      id: 'finalizers',
      name: 'Finalizers',
      value: `${finalizers.length} Finalizers`,
      hasDetail: true,
      renderDetail: () => (
        <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto pr-1 select-text">
          {finalizers.map((f) => (
            <span
              key={f}
              className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-surface-3 border border-border/60 text-zinc-350 truncate max-w-full"
              title={f}
            >
              {f}
            </span>
          ))}
        </div>
      )
    });
  }

  propertiesData.push(
    {
      id: 'type',
      name: 'Type',
      value: payload.type
    },
    {
      id: 'sessionAffinity',
      name: 'Session Affinity',
      value: payload.sessionAffinity
    },
    {
      id: 'clusterIp',
      name: 'Cluster IP',
      value: payload.clusterIp
    },
    {
      id: 'clusterIps',
      name: 'Cluster IPs',
      value: payload.clusterIps?.join(', ') || '—'
    },
    {
      id: 'ipFamilies',
      name: 'IP Families',
      value: payload.ipFamilies?.join(', ') || '—'
    },
    {
      id: 'ipFamilyPolicy',
      name: 'IP Family Policy',
      value: payload.ipFamilyPolicy
    },
    {
      id: 'externalIps',
      name: 'External IPs',
      value: payload.externalIps
    },
    {
      id: 'ports',
      name: 'Ports',
      value: (
        <div className="flex items-center justify-between w-full">
          <span className="font-mono text-accent text-[11px]">{payload.ports}</span>
          <button className="px-2.5 py-1 text-[10px] bg-accent hover:bg-accent/80 text-white font-medium rounded border-none cursor-pointer select-none transition-colors">
            Forward...
          </button>
        </div>
      )
    }
  );

  return (
    <div className={`flex flex-col gap-4 ${isTab ? 'p-6 h-full overflow-y-auto' : 'flex-1'}`}>
      {/* Properties Section */}
      <div className="flex flex-col gap-2.5 mt-1">
        <span className="text-[10px] font-bold text-zinc-450 uppercase tracking-wider mb-1">
          Properties
        </span>
        <KubePropertiesTable properties={propertiesData} />
      </div>

      {/* Endpoint Slices */}
      <div className="flex flex-col gap-1.5 mt-2 border-t border-border-dark/60 pt-3">
        <span className="text-[10px] font-bold text-zinc-450 uppercase tracking-wider mb-1">
          Endpoint Slices
        </span>
        {payload.endpointSlices.length === 0 ? (
          <div className="text-xs text-zinc-500 italic pl-1">No endpoint slices found</div>
        ) : (
          <div className="border-y border-border/40 flex flex-col h-auto max-h-[160px]">
            <KubeTable<ServiceEndpointSlice>
              columns={[
                {
                  key: 'name',
                  header: 'Name',
                  className: 'font-mono text-zinc-300 truncate max-w-[120px]',
                  render: (row) => <span title={row.name}>{row.name}</span>
                },
                {
                  key: 'endpointsCount',
                  header: 'Endpoints',
                  className: 'font-mono text-zinc-450'
                },
                {
                  key: 'ports',
                  header: 'Ports',
                  className: 'font-mono text-accent'
                },
                {
                  key: 'addressType',
                  header: 'Address Type',
                  className: 'font-mono text-zinc-450'
                },
                {
                  key: 'age',
                  header: 'Age',
                  className: 'font-mono text-zinc-500',
                  render: (row) => (
                    <Age
                      timestamp={
                        (row as unknown as Record<string, unknown>).creationTimestamp as string
                      }
                    />
                  )
                }
              ]}
              data={payload.endpointSlices}
              getRowKey={(row) => row.name}
              resizable={false}
            />
          </div>
        )}
      </div>

      {/* Endpoints */}
      <div className="flex flex-col gap-1.5 mt-2 border-t border-border-dark/60 pt-3">
        <span className="text-[10px] font-bold text-zinc-450 uppercase tracking-wider mb-1">
          Endpoints
        </span>
        {payload.endpoints.length === 0 ? (
          <div className="text-xs text-zinc-500 italic pl-1">No endpoints found</div>
        ) : (
          <div className="border-y border-border/40 flex flex-col h-auto max-h-[160px]">
            <KubeTable<ServiceEndpoint>
              columns={[
                {
                  key: 'name',
                  header: 'Name',
                  className: 'font-mono text-zinc-300 truncate max-w-[120px]',
                  render: (row) => <span title={row.name}>{row.name}</span>
                },
                {
                  key: 'endpoints',
                  header: 'Endpoints',
                  className: 'font-mono text-zinc-450 break-all select-text'
                }
              ]}
              data={payload.endpoints}
              getRowKey={(row) => row.name}
              resizable={false}
            />
          </div>
        )}
      </div>

      {/* Events Section */}
      <div className="flex flex-col gap-1.5 mt-2 border-t border-border-dark/60 pt-3">
        <span className="text-[10px] font-bold text-zinc-450 uppercase tracking-wider">Events</span>
        <div className="text-xs text-zinc-500 italic pl-1 mt-0.5">No events found</div>
      </div>
    </div>
  );
};
