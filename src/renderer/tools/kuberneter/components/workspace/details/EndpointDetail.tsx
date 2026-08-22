import { Age } from '../../Age';
import type React from 'react';
import { useMemo, useCallback } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { type EndpointData } from '../../../types/EndpointData';
import { useLayoutStore } from '../../../../../src/store/layout.store';
import { useKuberneterStore } from '../../../store/kuberneter.store';
import { KubePropertiesTable, type PropertyItem } from './KubePropertiesTable';
import { KubeTable, type Column } from '../../kube-table';
import {
  useOpenNamespaceDetail,
  useOpenPodDetail,
  useOpenNodeDetail,
  useOpenNetworkDetail,
  useOpenResourceDetail
} from '../../../hooks/open-detail';
import { K8S_RESOURCE_KEYS } from '../../../constants/k8sResources';
import { type K8sResource } from '../../../types/K8sResource';
import { buildEndpointDetailPayload } from '../../../hooks/open-detail/transformers/network.transformer';

interface EndpointDetailProps {
  payload: EndpointData;
  isTab?: boolean;
}

export const EndpointDetail: React.FC<EndpointDetailProps> = ({ payload, isTab = false }) => {
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

  // Live query for Endpoints
  const { data: queryData } = useQuery({
    queryKey: [
      'kuberneter',
      'endpoint-detail-data',
      rawConfigPath,
      cluster,
      payload?.ns,
      payload?.name
    ],
    queryFn: async () => {
      if (!cluster || !payload?.ns || !payload?.name) return null;
      const configPathArg = rawConfigPath === 'default' ? undefined : rawConfigPath;

      const epRes = await window.kuberneter.getResources(
        configPathArg,
        cluster,
        K8S_RESOURCE_KEYS.ENDPOINTS,
        payload.ns
      );
      const epItem = ((epRes?.items || []) as K8sResource[]).find(
        (i) => i.metadata?.name === payload.name
      );

      return buildEndpointDetailPayload(
        payload.name,
        payload.ns,
        epItem || (payload.rawItem as K8sResource)
      );
    },
    enabled: !!cluster && !!payload?.ns && !!payload?.name,
    placeholderData: keepPreviousData,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000
  });

  const currentData = queryData || payload;

  const handleNamespaceClick = useCallback(() => {
    if (currentData?.ns) {
      openNamespaceDetail(currentData.ns);
    }
  }, [currentData, openNamespaceDetail]);

  const handleServiceClick = useCallback(() => {
    if (currentData?.ns && currentData?.name) {
      openServiceDetail(currentData.ns, currentData.name);
    }
  }, [currentData, openServiceDetail]);

  const handlePodClick = useCallback(
    (podName: string, podNs?: string, kind = 'Pod') => {
      const ns = podNs || currentData?.ns;
      if (!podName || !ns) return;
      if (kind === 'Pod') {
        openPodDetail(ns, podName);
      } else {
        openResourceDetail(kind, ns, podName);
      }
    },
    [currentData, openPodDetail, openResourceDetail]
  );

  const handleNodeClick = useCallback(
    (nodeName?: string) => {
      if (nodeName && nodeName !== '—') {
        openNodeDetail(nodeName);
      }
    },
    [openNodeDetail]
  );

  const labels = currentData?.labels ? Object.entries(currentData.labels) : [];
  const annotations = currentData?.annotations ? Object.entries(currentData.annotations) : [];

  const creationTimestamp =
    currentData?.creationTimestamp ||
    (currentData as unknown as { rawItem?: { metadata?: { creationTimestamp?: string } } })?.rawItem
      ?.metadata?.creationTimestamp ||
    '';
  const createdTime =
    currentData?.createdTime ||
    (creationTimestamp ? new Date(creationTimestamp).toLocaleString() : '') ||
    'N/A';

  const propertiesData: PropertyItem[] = [
    {
      id: 'created',
      name: 'Created',
      value: (
        <span>
          {creationTimestamp ? <Age timestamp={creationTimestamp} /> : currentData?.age || '—'} ago
          ({createdTime})
        </span>
      )
    },
    {
      id: 'name',
      name: 'Name',
      value: currentData?.name || ''
    },
    {
      id: 'namespace',
      name: 'Namespace',
      value: currentData ? (
        <span
          onClick={handleNamespaceClick}
          className="font-mono text-accent hover:underline cursor-pointer"
        >
          {currentData.ns}
        </span>
      ) : (
        ''
      )
    },
    {
      id: 'service',
      name: 'Associated Service',
      value: currentData ? (
        <span
          onClick={handleServiceClick}
          className="font-mono text-accent hover:underline cursor-pointer"
        >
          {currentData.name}
        </span>
      ) : (
        ''
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

  // Consolidate addresses and ports across all subsets
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allAddresses = useMemo<any[]>(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const list: any[] = [];
    currentData?.subsets?.forEach((sub, subIdx) => {
      const addrs = sub.addresses || [];
      addrs.forEach((addr, addrIdx) => {
        list.push({
          id: `addr-${subIdx}-${addrIdx}-${addr.ip}`,
          ip: addr.ip,
          hostname: addr.hostname || '—',
          targetRefName: addr.targetRefName,
          targetRefNamespace: addr.targetRefNamespace,
          targetRefKind: addr.targetRefKind,
          nodeName: addr.nodeName
        });
      });
      const notReady = sub.notReadyAddresses || [];
      notReady.forEach((addr, addrIdx) => {
        list.push({
          id: `notready-${subIdx}-${addrIdx}-${addr.ip}`,
          ip: addr.ip,
          hostname: addr.hostname || '—',
          targetRefName: addr.targetRefName,
          targetRefNamespace: addr.targetRefNamespace,
          targetRefKind: addr.targetRefKind,
          nodeName: addr.nodeName,
          notReady: true
        });
      });
    });
    return list;
  }, [currentData?.subsets]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allPorts = useMemo<any[]>(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const list: any[] = [];
    currentData?.subsets?.forEach((sub, subIdx) => {
      const ports = sub.ports || [];
      ports.forEach((p, pIdx) => {
        list.push({
          id: `port-${subIdx}-${pIdx}-${p.port}`,
          port: p.port,
          name: p.name || '—',
          protocol: p.protocol || '—'
        });
      });
    });
    return list;
  }, [currentData?.subsets]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const addressColumns = useMemo<Column<any>[]>(
    () => [
      {
        key: 'ip',
        header: 'IP',
        render: (row) => (
          <span className="font-mono text-zinc-300">
            {row.ip}
            {row.notReady && <span className="text-red-400 text-[10px] ml-1.5">(not ready)</span>}
          </span>
        ),
        initialWidth: 150
      },
      {
        key: 'hostname',
        header: 'Hostname',
        render: (row) => <span className="font-mono text-zinc-300">{row.hostname}</span>,
        initialWidth: 150
      },
      {
        key: 'target',
        header: 'Target',
        render: (row) =>
          row.targetRefName ? (
            <span
              onClick={(e) => {
                e.stopPropagation();
                handlePodClick(row.targetRefName, row.targetRefNamespace, row.targetRefKind);
              }}
              className="font-mono text-accent hover:underline cursor-pointer"
              title={`${row.targetRefKind || 'Pod'}: ${row.targetRefName}`}
            >
              {row.targetRefName}
            </span>
          ) : (
            <span className="text-zinc-555">—</span>
          ),
        initialWidth: 240
      },
      {
        key: 'node',
        header: 'Node',
        render: (row) =>
          row.nodeName ? (
            <span
              onClick={(e) => {
                e.stopPropagation();
                handleNodeClick(row.nodeName);
              }}
              className="font-mono text-accent hover:underline cursor-pointer"
              title={row.nodeName}
            >
              {row.nodeName}
            </span>
          ) : (
            <span className="text-zinc-555">—</span>
          ),
        initialWidth: 140
      }
    ],
    [handlePodClick, handleNodeClick]
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const portColumns = useMemo<Column<any>[]>(
    () => [
      {
        key: 'port',
        header: 'Port',
        render: (row) => <span className="font-mono text-zinc-300">{row.port}</span>,
        initialWidth: 120
      },
      {
        key: 'name',
        header: 'Name',
        render: (row) => <span className="font-mono text-zinc-300">{row.name}</span>,
        initialWidth: 160
      },
      {
        key: 'protocol',
        header: 'Protocol',
        render: (row) => <span className="font-mono text-zinc-300">{row.protocol}</span>,
        initialWidth: 120
      }
    ],
    []
  );

  if (!payload) {
    return <div className="p-4 text-xs text-zinc-500">No Endpoint details available.</div>;
  }

  return (
    <div className={`flex flex-col gap-4 ${isTab ? 'p-6 h-full overflow-y-auto' : 'flex-1'}`}>
      {/* Properties Section */}
      <div className="flex flex-col gap-2.5 mt-1">
        <span className="text-[10px] font-bold text-zinc-450 uppercase tracking-wider mb-1">
          Properties
        </span>
        <KubePropertiesTable properties={propertiesData} />
      </div>

      {/* Subsets Section */}
      <div className="flex flex-col gap-1.5 mt-2 border-t border-border-dark/60 pt-3">
        <span className="text-[10px] font-bold text-zinc-450 uppercase tracking-wider mb-1">
          Subsets
        </span>

        {/* Addresses Table */}
        <div className="flex flex-col gap-1.5 mt-1">
          <span className="text-[10px] font-bold text-zinc-400">
            Addresses ({allAddresses.length})
          </span>
          {allAddresses.length > 0 ? (
            <div className="flex flex-col border-y border-border/40 bg-surface-2/30 h-auto max-h-[180px]">
              <KubeTable
                columns={addressColumns}
                data={allAddresses}
                getRowKey={(row) => row.id}
                resizable={false}
                emptyMessage="No addresses configured."
              />
            </div>
          ) : (
            <span className="text-xs text-zinc-500 italic px-1">No addresses configured.</span>
          )}
        </div>

        {/* Ports Table */}
        <div className="flex flex-col gap-1.5 mt-3">
          <span className="text-[10px] font-bold text-zinc-400">Ports ({allPorts.length})</span>
          {allPorts.length > 0 ? (
            <div className="flex flex-col border-y border-border/40 bg-surface-2/30 h-auto max-h-[160px]">
              <KubeTable
                columns={portColumns}
                data={allPorts}
                getRowKey={(row) => row.id}
                resizable={false}
                emptyMessage="No ports configured."
              />
            </div>
          ) : (
            <span className="text-xs text-zinc-500 italic px-1">No ports configured.</span>
          )}
        </div>
      </div>

      {/* Events Section */}
      <div className="flex flex-col gap-1.5 mt-2 border-t border-border-dark/60 pt-3">
        <span className="text-[10px] font-bold text-zinc-455 uppercase tracking-wider">Events</span>
        <div className="text-xs text-zinc-500 italic pl-1 mt-0.5">No events found</div>
      </div>
    </div>
  );
};
