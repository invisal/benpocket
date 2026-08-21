import { Age } from '../../Age';
import type React from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import {
  type EndpointSliceData,
  type EndpointSliceEndpoint,
  type EndpointSlicePort
} from '../../../types/EndpointSliceData';
import { useLayoutStore } from '../../../../../src/store/layout.store';
import { useKuberneterStore } from '../../../store/kuberneter.store';
import { KubeTable } from '../../kubeTable';
import { KubePropertiesTable, type PropertyItem } from './KubePropertiesTable';
import {
  useOpenNamespaceDetail,
  useOpenPodDetail,
  useOpenNodeDetail,
  useOpenNetworkDetail,
  useOpenResourceDetail
} from '../../../hooks/open-detail';
import { K8S_RESOURCE_KEYS } from '../../../constants/k8sResources';
import { type K8sResource } from '../../../types/K8sResource';
import { buildEndpointSliceDetailPayload } from '../../../hooks/open-detail/transformers/network.transformer';

interface EndpointSliceDetailProps {
  payload: EndpointSliceData;
  isTab?: boolean;
}

export const EndpointSliceDetail: React.FC<EndpointSliceDetailProps> = ({
  payload,
  isTab = false
}) => {
  const activeInstanceId = useLayoutStore((s) => s.activeInstanceId);
  const cluster = useKuberneterStore((s) => s.kuberneterInstanceCluster[activeInstanceId] || '');
  const rawConfigPath = useKuberneterStore(
    (s) => s.kuberneterInstanceConfigPath[activeInstanceId] || 'default'
  );

  const { openNamespaceDetail } = useOpenNamespaceDetail();
  const { openPodDetail } = useOpenPodDetail();
  const { openNodeDetail } = useOpenNodeDetail();
  const { openServiceDetail } = useOpenNetworkDetail();
  const { openResourceDetail } = useOpenResourceDetail();

  // Live query for EndpointSlice
  const { data: queryData } = useQuery({
    queryKey: [
      'kuberneter',
      'endpointslice-detail-data',
      rawConfigPath,
      cluster,
      payload?.ns,
      payload?.name
    ],
    queryFn: async () => {
      if (!cluster || !payload?.ns || !payload?.name) return null;
      const configPathArg = rawConfigPath === 'default' ? undefined : rawConfigPath;

      const epsRes = await window.kuberneter.getResources(
        configPathArg,
        cluster,
        K8S_RESOURCE_KEYS.ENDPOINT_SLICES,
        payload.ns
      );
      const sliceItem = ((epsRes?.items || []) as K8sResource[]).find(
        (i) => i.metadata?.name === payload.name
      );

      return buildEndpointSliceDetailPayload(
        payload.name,
        payload.ns,
        sliceItem || (payload.rawItem as K8sResource)
      );
    },
    enabled: !!cluster && !!payload?.ns && !!payload?.name,
    placeholderData: keepPreviousData,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000
  });

  if (!payload) {
    return <div className="p-4 text-xs text-zinc-500">No Endpoint Slice details available.</div>;
  }

  const currentData = queryData || payload;

  const handleNamespaceClick = () => {
    if (currentData.ns) {
      openNamespaceDetail(currentData.ns);
    }
  };

  const handleServiceClick = (serviceName: string) => {
    if (currentData.ns && serviceName) {
      openServiceDetail(currentData.ns, serviceName);
    }
  };

  const handlePodClick = (podName: string, podNs?: string, kind = 'Pod') => {
    const ns = podNs || currentData.ns;
    if (kind === 'Pod') {
      openPodDetail(ns, podName);
    } else {
      openResourceDetail(kind, ns, podName);
    }
  };

  const handleNodeClick = (nodeName: string) => {
    if (nodeName && nodeName !== '—') {
      openNodeDetail(nodeName);
    }
  };

  const annotations = currentData.annotations ? Object.entries(currentData.annotations) : [];
  const labels = currentData.labels ? Object.entries(currentData.labels) : [];
  const endpoints = currentData.endpoints || [];
  const ports = currentData.ports || [];
  const serviceName = currentData.labels?.['kubernetes.io/service-name'];

  const creationTimestamp =
    currentData.creationTimestamp ||
    (currentData as unknown as { rawItem?: { metadata?: { creationTimestamp?: string } } })?.rawItem?.metadata?.creationTimestamp ||
    '';
  const createdTime =
    currentData.createdTime ||
    (creationTimestamp ? new Date(creationTimestamp).toLocaleString() : '') ||
    'N/A';

  const propertiesData: PropertyItem[] = [
    {
      id: 'created',
      name: 'Created',
      value: (
        <span>
          {creationTimestamp ? (
            <Age timestamp={creationTimestamp} />
          ) : (
            currentData.age || '—'
          )}{' '}
          ago ({createdTime})
        </span>
      )
    },
    {
      id: 'name',
      name: 'Name',
      value: currentData.name
    },
    {
      id: 'namespace',
      name: 'Namespace',
      value: (
        <span
          onClick={handleNamespaceClick}
          className="font-mono text-accent hover:underline cursor-pointer"
        >
          {currentData.ns}
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

  if (serviceName || currentData.controlledByName) {
    const svcName = serviceName || currentData.controlledByName!;
    propertiesData.push({
      id: 'service',
      name: 'Service',
      value: (
        <span
          onClick={() => handleServiceClick(svcName)}
          className="text-accent hover:underline cursor-pointer font-mono"
        >
          {svcName}
        </span>
      )
    });
  }

  if (currentData.controlledByName && currentData.controlledByName !== serviceName) {
    propertiesData.push({
      id: 'controlledBy',
      name: 'Controlled By',
      value: (
        <span>
          {currentData.controlledByKind || 'Service'}{' '}
          <span
            onClick={() =>
              currentData.controlledByName &&
              openResourceDetail(
                currentData.controlledByKind || 'Service',
                currentData.ns,
                currentData.controlledByName
              )
            }
            className="text-accent hover:underline cursor-pointer font-mono"
          >
            {currentData.controlledByName}
          </span>
        </span>
      )
    });
  }

  propertiesData.push({
    id: 'addressType',
    name: 'Address Type',
    value: currentData.addressType
  });

  return (
    <div className={`flex flex-col gap-4 ${isTab ? 'p-6 h-full overflow-y-auto' : 'flex-1'}`}>
      {/* Properties Section */}
      <div className="flex flex-col gap-2.5 mt-1">
        <span className="text-[10px] font-bold text-zinc-450 uppercase tracking-wider mb-1">
          Properties
        </span>
        <KubePropertiesTable properties={propertiesData} />
      </div>

      {/* Endpoints Table Section */}
      <div className="flex flex-col gap-1.5 mt-2 border-t border-border-dark/60 pt-3">
        <span className="text-[10px] font-bold text-zinc-450 uppercase tracking-wider mb-1">
          Endpoints ({endpoints.length})
        </span>
        {endpoints.length === 0 ? (
          <div className="text-xs text-zinc-500 italic pl-1">No endpoints found</div>
        ) : (
          <div className="border-y border-border/40 flex flex-col max-h-[180px] h-auto w-full overflow-y-auto">
            <KubeTable<EndpointSliceEndpoint>
              columns={[
                {
                  key: 'addresses',
                  header: 'Addresses',
                  className: 'font-mono text-zinc-300 truncate max-w-[140px]',
                  render: (row) => (
                    <span title={row.addresses.join(', ')}>{row.addresses.join(', ') || '—'}</span>
                  )
                },
                {
                  key: 'ready',
                  header: 'Ready',
                  className: 'font-mono text-zinc-350',
                  render: (row) => (
                    <span
                      className={
                        row.ready === true
                          ? 'text-emerald-400 font-semibold'
                          : row.ready === false
                            ? 'text-rose-400 font-semibold'
                            : 'text-zinc-500'
                      }
                    >
                      {row.ready !== undefined ? (row.ready ? 'True' : 'False') : '—'}
                    </span>
                  )
                },
                {
                  key: 'target',
                  header: 'Target',
                  className: 'font-mono text-accent truncate max-w-[180px]',
                  render: (row) =>
                    row.targetRefName ? (
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePodClick(
                            row.targetRefName!,
                            row.targetRefNamespace,
                            row.targetRefKind
                          );
                        }}
                        className="hover:underline cursor-pointer"
                        title={`${row.targetRefKind || 'Pod'}: ${row.targetRefName}`}
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
                  className: 'font-mono text-accent truncate max-w-[140px]',
                  render: (row) =>
                    row.nodeName ? (
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          handleNodeClick(row.nodeName!);
                        }}
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
                  render: (row) => <span>{row.zone || '—'}</span>
                }
              ]}
              data={endpoints}
              getRowKey={(row) => `${row.addresses.join('-')}-${row.targetRefName || ''}`}
              resizable={false}
            />
          </div>
        )}
      </div>

      {/* Ports Table Section */}
      <div className="flex flex-col gap-1.5 mt-2 border-t border-border-dark/60 pt-3">
        <span className="text-[10px] font-bold text-zinc-450 uppercase tracking-wider mb-1">
          Ports ({ports.length})
        </span>
        {ports.length === 0 ? (
          <div className="text-xs text-zinc-500 italic pl-1">No ports found</div>
        ) : (
          <div className="border-y border-border/40 flex flex-col max-h-[140px] h-auto w-full overflow-y-auto">
            <KubeTable<EndpointSlicePort>
              columns={[
                {
                  key: 'name',
                  header: 'Name',
                  className: 'font-mono text-zinc-350 truncate max-w-[140px]',
                  render: (row) => <span title={row.name}>{row.name || '—'}</span>
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
                  render: (row) => <span>{row.appProtocol || '—'}</span>
                }
              ]}
              data={ports}
              getRowKey={(row) => `${row.name || ''}-${row.port || ''}`}
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
