import { Age } from '../../Age';
import type React from 'react';
import { useMemo } from 'react';
import { KubeTable, type Column } from '../../kubeTable';
import { MoreVertical } from 'lucide-react';
import { type EndpointSliceData } from '../../../types/EndpointSliceData';

interface EndpointSlicesTableProps {
  filteredData: EndpointSliceData[];
  selectedIds: Set<string>;
  onSelectAll: (checked: boolean) => void;
  onSelectRow: (id: string, checked: boolean) => void;
  onSelectEndpointSlice: (slice: EndpointSliceData) => void;
  selectedEndpointSliceId?: string;
}

export const EndpointSlicesTable: React.FC<EndpointSlicesTableProps> = ({
  filteredData,
  selectedIds,
  onSelectAll,
  onSelectRow,
  onSelectEndpointSlice,
  selectedEndpointSliceId
}) => {
  const columns = useMemo<Column<EndpointSliceData>[]>(
    () => [
      {
        key: 'select',
        header: (
          <input
            type="checkbox"
            checked={filteredData.length > 0 && selectedIds.size === filteredData.length}
            onChange={(e) => onSelectAll(e.target.checked)}
            className="size-3 rounded border border-border-dark text-accent focus:ring-0 cursor-pointer accent-accent bg-surface-3"
          />
        ),
        render: (row) => (
          <input
            type="checkbox"
            checked={selectedIds.has(row.id)}
            onChange={(e) => onSelectRow(row.id, e.target.checked)}
            onClick={(e) => e.stopPropagation()}
            className="size-3 rounded border border-border-dark text-accent focus:ring-0 cursor-pointer accent-accent bg-surface-3"
          />
        ),
        headerClassName: 'w-10 text-center',
        className: 'w-10 text-center',
        initialWidth: 40,
        resizable: false,
        sortable: false
      },
      {
        key: 'name',
        header: 'Name',
        render: (row) => (
          <span
            className="font-mono text-zinc-300 font-semibold truncate hover:underline cursor-pointer"
            title={row.name}
          >
            {row.name}
          </span>
        ),
        className: 'font-mono text-zinc-300 max-w-[220px] truncate',
        initialWidth: 220
      },
      {
        key: 'namespace',
        header: 'Namespace',
        render: (row) => (
          <span className="font-mono text-accent hover:underline cursor-pointer">{row.ns}</span>
        ),
        className: 'font-mono text-accent',
        initialWidth: 120
      },
      {
        key: 'addressType',
        header: 'Address Type',
        render: (row) => <span className="text-zinc-300">{row.addressType}</span>,
        initialWidth: 120
      },
      {
        key: 'endpoints',
        header: 'Endpoints',
        render: (row) => (
          <span
            className="font-mono text-zinc-400 text-[11px] truncate block max-w-[300px]"
            title={row.endpointsStr}
          >
            {row.endpointsStr}
          </span>
        ),
        initialWidth: 260
      },
      {
        key: 'ports',
        header: 'Ports',
        render: (row) => <span className="font-mono text-accent text-[11px]">{row.portsStr}</span>,
        initialWidth: 140
      },
      {
        key: 'age',
        header: 'Age',
        render: (row) => (
          <span className="text-zinc-500 font-mono text-[11px]">
            <Age
              timestamp={(row as unknown as Record<string, unknown>).creationTimestamp as string}
            />
          </span>
        ),
        className: 'text-zinc-500',
        initialWidth: 100
      },
      {
        key: 'actions',
        header: (
          <div className="flex justify-center select-none">
            <MoreVertical className="size-3.5 text-zinc-555" />
          </div>
        ),
        render: () => (
          <div className="flex justify-center">
            <button
              onClick={(e) => e.stopPropagation()}
              className="p-1 rounded hover:bg-surface-3 text-zinc-500 hover:text-white cursor-pointer border-none bg-transparent"
            >
              <MoreVertical className="size-3.5" />
            </button>
          </div>
        ),
        headerClassName: 'w-10 text-center',
        className: 'w-10 text-center',
        initialWidth: 40,
        resizable: false
      }
    ],
    [filteredData, selectedIds, onSelectAll, onSelectRow]
  );

  return (
    <KubeTable
      columns={columns}
      data={filteredData}
      getRowKey={(row) => row.id}
      className="flex-1"
      onRowClick={(row) => onSelectEndpointSlice(row)}
      selectedRowKey={selectedEndpointSliceId}
      emptyMessage="No Endpoint Slices match the search filters."
    />
  );
};
