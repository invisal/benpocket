import { Age } from '../../Age';
import type React from 'react';
import { useMemo, useCallback } from 'react';
import { type EndpointData } from '../../../types/EndpointData';
import { useLayoutStore } from '../../../../../src/store/layout.store';
import { useKuberneterStore } from '../../../store/kuberneter.store';
import { KubePropertiesTable, type PropertyItem } from './KubePropertiesTable';
import { KubeTable, type Column } from '../../kube-table';

interface EndpointDetailProps {
  payload: EndpointData;
  isTab?: boolean;
}

export const EndpointDetail: React.FC<EndpointDetailProps> = ({ payload, isTab = false }) => {
  const activeInstanceId = useLayoutStore((s) => s.activeInstanceId);
  const setNamespace = useKuberneterStore((s) => s.setKuberneterInstanceNamespace);
  const setResource = useKuberneterStore((s) => s.setKuberneterInstanceResource);

  const handleNamespaceClick = useCallback(() => {
    if (payload?.ns && activeInstanceId) {
      setNamespace(activeInstanceId, payload.ns);
    }
  }, [payload, activeInstanceId, setNamespace]);

  const handlePodClick = useCallback(() => {
    if (activeInstanceId) {
      setResource(activeInstanceId, 'pods');
    }
  }, [activeInstanceId, setResource]);

  const labels = payload?.labels ? Object.entries(payload.labels) : [];
  const annotations = payload?.annotations ? Object.entries(payload.annotations) : [];

  const propertiesData: PropertyItem[] = [
    {
      id: 'created',
      name: 'Created',
      value: payload ? (
        <span>
          <Age
            timestamp={(payload as unknown as Record<string, unknown>).creationTimestamp as string}
          />{' '}
          ago ({((payload as unknown as Record<string, unknown>).createdTime as string) || 'N/A'})
        </span>
      ) : (
        ''
      )
    },
    {
      id: 'name',
      name: 'Name',
      value: payload?.name || ''
    },
    {
      id: 'namespace',
      name: 'Namespace',
      value: payload ? (
        <span
          onClick={handleNamespaceClick}
          className="font-mono text-accent hover:underline cursor-pointer"
        >
          {payload.ns}
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
    payload?.subsets?.forEach((sub, subIdx) => {
      const addrs = sub.addresses || [];
      addrs.forEach((addr, addrIdx) => {
        list.push({
          id: `addr-${subIdx}-${addrIdx}-${addr.ip}`,
          ip: addr.ip,
          hostname: addr.hostname || '—',
          targetRefName: addr.targetRefName,
          targetRefNamespace: addr.targetRefNamespace,
          targetRefKind: addr.targetRefKind
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
          notReady: true
        });
      });
    });
    return list;
  }, [payload?.subsets]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allPorts = useMemo<any[]>(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const list: any[] = [];
    payload?.subsets?.forEach((sub, subIdx) => {
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
  }, [payload?.subsets]);

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
              onClick={handlePodClick}
              className="font-mono text-accent hover:underline cursor-pointer"
            >
              {row.targetRefName}
            </span>
          ) : (
            <span className="text-zinc-555">—</span>
          ),
        initialWidth: 280
      }
    ],
    [handlePodClick]
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
          <span className="text-[10px] font-bold text-zinc-400">Addresses</span>
          {allAddresses.length > 0 ? (
            <div className="flex flex-col border-y border-border/40 bg-surface-2/30 h-auto max-h-[160px]">
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
          <span className="text-[10px] font-bold text-zinc-400">Ports</span>
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
