import type React from 'react';
import { useState } from 'react';
import {
  type ServiceData,
  type ServiceEndpointSlice,
  type ServiceEndpoint
} from '../../../types/ServiceData';
import { useLayoutStore } from '../../../../../src/store/layout.store';
import { useKuberneterStore } from '../../../store/kuberneter.store';
import { KubeTable } from '../../kubeTable';

interface ServiceDetailProps {
  payload: ServiceData;
  isTab?: boolean;
}

export const ServiceDetail: React.FC<ServiceDetailProps> = ({ payload, isTab = false }) => {
  const [annotationsExpanded, setAnnotationsExpanded] = useState(false);
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
  const selectors = payload.selector ? Object.entries(payload.selector) : [];
  const finalizers = payload.finalizers || [];

  return (
    <div className={`flex flex-col gap-4 ${isTab ? 'p-6 h-full overflow-y-auto' : 'flex-1'}`}>
      {/* Properties Section */}
      <div className="flex flex-col gap-2.5 mt-1">
        <span className="text-[10px] font-bold text-zinc-450 uppercase tracking-wider mb-1">
          Properties
        </span>
        <div className="flex flex-col gap-2.5 text-xs text-zinc-350 bg-surface-2/40 border border-border/40 rounded-lg p-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] text-zinc-555 uppercase">Created</span>
            <span className="font-mono text-zinc-300">
              {payload.age} ago ({payload.createdTime || 'N/A'})
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] text-zinc-555 uppercase">Name</span>
            <span className="font-mono text-zinc-200 break-all">{payload.name}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] text-zinc-555 uppercase">Namespace</span>
            <span
              onClick={handleNamespaceClick}
              className="font-mono text-accent hover:underline cursor-pointer self-start"
            >
              {payload.ns}
            </span>
          </div>

          {/* Annotations Collapsible */}
          <div className="flex flex-col gap-0.5">
            <div
              className="flex justify-between items-center cursor-pointer select-none"
              onClick={() => setAnnotationsExpanded(!annotationsExpanded)}
            >
              <span className="text-[10px] text-zinc-555 uppercase flex items-center gap-1">
                Annotations
                <span className="text-[9px] text-zinc-650 font-normal">
                  {annotationsExpanded ? '▲' : '▼'}
                </span>
              </span>
              <span className="text-xs text-zinc-400 font-medium">
                {annotations.length} Annotations
              </span>
            </div>
            {annotationsExpanded && annotations.length > 0 && (
              <div className="flex flex-col gap-1 mt-1.5 max-h-24 overflow-y-auto pr-1 select-text">
                {annotations.map(([k, v]) => (
                  <div
                    key={k}
                    className="font-mono text-[10px] text-zinc-400 bg-editor-bg px-2 py-1 rounded border border-border-dark/60 truncate"
                    title={`${k}=${v}`}
                  >
                    {k}={v}
                  </div>
                ))}
              </div>
            )}
          </div>

          {finalizers.length > 0 && (
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] text-zinc-555 uppercase">Finalizers</span>
              <div className="flex flex-wrap gap-1 mt-0.5">
                {finalizers.map((f) => (
                  <span
                    key={f}
                    className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-surface-3 border border-border/60 text-zinc-350"
                  >
                    {f}
                  </span>
                ))}
              </div>
            </div>
          )}

          {selectors.length > 0 && (
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] text-zinc-555 uppercase">Selector</span>
              <div className="flex flex-wrap gap-1 mt-0.5">
                {selectors.map(([k, v]) => (
                  <span
                    key={k}
                    className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-surface-3 border border-border/60 text-zinc-350"
                  >
                    {k}={v}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-0.5 border-t border-border/20 pt-2">
            <span className="text-[10px] text-zinc-555 uppercase">Type</span>
            <span className="font-mono text-zinc-300">{payload.type}</span>
          </div>

          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] text-zinc-555 uppercase">Session Affinity</span>
            <span className="font-mono text-zinc-300">{payload.sessionAffinity}</span>
          </div>
        </div>
      </div>

      {/* Connection Section */}
      <div className="flex flex-col gap-2.5">
        <span className="text-[10px] font-bold text-zinc-450 uppercase tracking-wider mb-1">
          Connection
        </span>
        <div className="flex flex-col gap-2.5 text-xs text-zinc-350 bg-surface-2/40 border border-border/40 rounded-lg p-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] text-zinc-555 uppercase">Cluster IP</span>
            <span className="font-mono text-zinc-300">{payload.clusterIp}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] text-zinc-555 uppercase">Cluster IPs</span>
            <span className="font-mono text-zinc-300">{payload.clusterIps.join(', ') || '—'}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] text-zinc-555 uppercase">IP families</span>
            <span className="font-mono text-zinc-300">{payload.ipFamilies.join(', ') || '—'}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] text-zinc-555 uppercase">IP family policy</span>
            <span className="font-mono text-zinc-300">{payload.ipFamilyPolicy}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] text-zinc-555 uppercase">External IPs</span>
            <span className="font-mono text-zinc-300">{payload.externalIps}</span>
          </div>
          <div className="flex flex-col gap-0.5 border-t border-border/20 pt-2">
            <span className="text-[10px] text-zinc-555 uppercase">Ports</span>
            <div className="flex items-center justify-between mt-1">
              <span className="font-mono text-accent text-[11px]">{payload.ports}</span>
              <button className="px-2.5 py-1 text-[10px] bg-accent hover:bg-accent/80 text-white font-medium rounded border-none cursor-pointer select-none transition-colors">
                Forward...
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Endpoint Slices */}
      <div className="flex flex-col gap-1.5 mt-2 border-t border-border-dark/60 pt-3">
        <span className="text-[10px] font-bold text-zinc-450 uppercase tracking-wider mb-1">
          Endpoint Slices
        </span>
        {payload.endpointSlices.length === 0 ? (
          <div className="text-xs text-zinc-500 italic pl-1">No endpoint slices found</div>
        ) : (
          <div className="border border-border/40 rounded-lg overflow-hidden flex flex-col h-40">
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
                  className: 'font-mono text-zinc-500'
                }
              ]}
              data={payload.endpointSlices}
              getRowKey={(row) => row.name}
              variant="modern"
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
          <div className="border border-border/40 rounded-lg overflow-hidden flex flex-col h-28">
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
              variant="modern"
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
