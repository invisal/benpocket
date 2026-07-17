import type React from 'react';
import { useState } from 'react';
import {
  type EndpointSliceData,
  type EndpointSliceEndpoint,
  type EndpointSlicePort
} from '../../../types/EndpointSliceData';
import { useLayoutStore } from '../../../../../src/store/layout.store';
import { useKuberneterStore } from '../../../store/kuberneter.store';
import { KubeTable } from '../../kubeTable';

interface EndpointSliceDetailProps {
  payload: EndpointSliceData;
  isTab?: boolean;
}

export const EndpointSliceDetail: React.FC<EndpointSliceDetailProps> = ({
  payload,
  isTab = false
}) => {
  const [annotationsExpanded, setAnnotationsExpanded] = useState(false);
  const [labelsExpanded, setLabelsExpanded] = useState(false);
  const activeInstanceId = useLayoutStore((s) => s.activeInstanceId);
  const openTab = useLayoutStore((s) => s.openTab);
  const setNamespace = useKuberneterStore((s) => s.setKuberneterInstanceNamespace);
  const setKuberneterInstanceResource = useKuberneterStore((s) => s.setKuberneterInstanceResource);

  if (!payload) {
    return <div className="p-4 text-xs text-zinc-500">No Endpoint Slice details available.</div>;
  }

  const handleNamespaceClick = () => {
    if (payload.ns && activeInstanceId) {
      setNamespace(activeInstanceId, payload.ns);
    }
  };

  const handleServiceClick = (serviceName: string) => {
    console.debug('Navigate to service:', serviceName);
    if (activeInstanceId) {
      setKuberneterInstanceResource(activeInstanceId, 'services');
      openTab({
        id: `kuberneter-k8s-services-${activeInstanceId}`,
        title: `K8s Services`,
        type: 'kuberneter',
        instanceId: activeInstanceId,
        meta: { resource: 'services' }
      });
    }
  };

  const handlePodClick = (podName: string) => {
    console.debug('Navigate to pod:', podName);
    if (activeInstanceId) {
      setKuberneterInstanceResource(activeInstanceId, 'pods');
      openTab({
        id: `kuberneter-k8s-pods-${activeInstanceId}`,
        title: `K8s Pods`,
        type: 'kuberneter',
        instanceId: activeInstanceId,
        meta: { resource: 'pods' }
      });
    }
  };

  const handleNodeClick = (nodeName: string) => {
    console.debug('Navigate to node:', nodeName);
    if (activeInstanceId) {
      setKuberneterInstanceResource(activeInstanceId, 'nodes');
      openTab({
        id: `kuberneter-k8s-nodes-${activeInstanceId}`,
        title: `K8s Nodes`,
        type: 'kuberneter',
        instanceId: activeInstanceId,
        meta: { resource: 'nodes' }
      });
    }
  };

  const annotations = payload.annotations ? Object.entries(payload.annotations) : [];
  const labels = payload.labels ? Object.entries(payload.labels) : [];

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

          {/* Labels Collapsible */}
          <div className="flex flex-col gap-0.5">
            <div
              className="flex justify-between items-center cursor-pointer select-none"
              onClick={() => setLabelsExpanded(!labelsExpanded)}
            >
              <span className="text-[10px] text-zinc-555 uppercase flex items-center gap-1">
                Labels
                <span className="text-[9px] text-zinc-650 font-normal">
                  {labelsExpanded ? '▲' : '▼'}
                </span>
              </span>
              <span className="text-xs text-zinc-400 font-medium">{labels.length} Labels</span>
            </div>
            {labelsExpanded && labels.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5 max-h-24 overflow-y-auto pr-1 select-text">
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
            )}
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

          {payload.controlledByName && (
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] text-zinc-555 uppercase">Controlled By</span>
              <span className="font-mono text-zinc-350">
                {payload.controlledByKind || 'Service'}{' '}
                <span
                  onClick={() =>
                    payload.controlledByName && handleServiceClick(payload.controlledByName)
                  }
                  className="text-accent hover:underline cursor-pointer"
                >
                  {payload.controlledByName}
                </span>
              </span>
            </div>
          )}

          <div className="flex flex-col gap-0.5 border-t border-border/20 pt-2">
            <span className="text-[10px] text-zinc-555 uppercase">Address Type</span>
            <span className="font-mono text-zinc-300">{payload.addressType}</span>
          </div>
        </div>
      </div>

      {/* Endpoints Table Section */}
      <div className="flex flex-col gap-1.5 mt-2 border-t border-border-dark/60 pt-3">
        <span className="text-[10px] font-bold text-zinc-450 uppercase tracking-wider mb-1">
          Endpoints
        </span>
        {payload.endpoints.length === 0 ? (
          <div className="text-xs text-zinc-500 italic pl-1">No endpoints found</div>
        ) : (
          <div className="border border-border/40 rounded-lg overflow-hidden flex flex-col h-40">
            <KubeTable<EndpointSliceEndpoint>
              columns={[
                {
                  key: 'addresses',
                  header: 'Addresses',
                  className: 'font-mono text-zinc-300 truncate max-w-[120px]',
                  render: (row) => (
                    <span title={row.addresses.join(', ')}>{row.addresses.join(', ') || '—'}</span>
                  )
                },
                {
                  key: 'ready',
                  header: 'Ready',
                  className: 'font-mono text-zinc-350',
                  render: (row) => (
                    <span>{row.ready !== undefined ? (row.ready ? 'True' : 'False') : '—'}</span>
                  )
                },
                {
                  key: 'target',
                  header: 'Target',
                  className: 'font-mono text-accent truncate max-w-[150px]',
                  render: (row) =>
                    row.targetRefName ? (
                      <span
                        onClick={() => row.targetRefName && handlePodClick(row.targetRefName)}
                        className="hover:underline cursor-pointer"
                        title={row.targetRefName}
                      >
                        {row.targetRefName}
                      </span>
                    ) : (
                      <span className="text-zinc-650 font-mono">—</span>
                    )
                },
                {
                  key: 'node',
                  header: 'Node',
                  className: 'font-mono text-accent truncate max-w-[120px]',
                  render: (row) =>
                    row.nodeName ? (
                      <span
                        onClick={() => row.nodeName && handleNodeClick(row.nodeName)}
                        className="hover:underline cursor-pointer"
                        title={row.nodeName}
                      >
                        {row.nodeName}
                      </span>
                    ) : (
                      <span className="text-zinc-650 font-mono">—</span>
                    )
                },
                {
                  key: 'zone',
                  header: 'Zone',
                  className: 'font-mono text-zinc-500',
                  render: (row) => <span>{row.zone}</span>
                }
              ]}
              data={payload.endpoints}
              getRowKey={(row) => row.addresses.join('-')}
              variant="modern"
              resizable={false}
            />
          </div>
        )}
      </div>

      {/* Ports Table Section */}
      <div className="flex flex-col gap-1.5 mt-2 border-t border-border-dark/60 pt-3">
        <span className="text-[10px] font-bold text-zinc-450 uppercase tracking-wider mb-1">
          Ports
        </span>
        {payload.ports.length === 0 ? (
          <div className="text-xs text-zinc-500 italic pl-1">No ports found</div>
        ) : (
          <div className="border border-border/40 rounded-lg overflow-hidden flex flex-col h-28">
            <KubeTable<EndpointSlicePort>
              columns={[
                {
                  key: 'name',
                  header: 'Name',
                  className: 'font-mono text-zinc-350 truncate max-w-[120px]',
                  render: (row) => <span title={row.name}>{row.name}</span>
                },
                {
                  key: 'port',
                  header: 'Port',
                  className: 'font-mono text-zinc-300',
                  render: (row) => <span>{row.port !== undefined ? row.port : '—'}</span>
                },
                {
                  key: 'protocol',
                  header: 'Protocol',
                  className: 'font-mono text-accent',
                  render: (row) => <span>{row.protocol || '—'}</span>
                },
                {
                  key: 'appProtocol',
                  header: 'App Protocol',
                  className: 'font-mono text-zinc-500',
                  render: (row) => <span>{row.appProtocol}</span>
                }
              ]}
              data={payload.ports}
              getRowKey={(row) => `${row.name}-${row.port}`}
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
