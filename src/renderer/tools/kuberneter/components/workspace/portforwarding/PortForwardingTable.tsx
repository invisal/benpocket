import type React from 'react';
import { useMemo } from 'react';
import { KubeTable, type Column } from '../../kubeTable';
import { MoreVertical } from 'lucide-react';
import { type PortForwardData } from '../../../types/PortForwardData';
import { usePortForwardingStore } from '../../../store/portForwarding.store';
import { cn } from 'cnfast';

interface PortForwardingTableProps {
  filteredData: PortForwardData[];
  selectedIds: Set<string>;
  onSelectAll: (checked: boolean) => void;
  onSelectRow: (id: string, checked: boolean) => void;
  onSelectEntry: (entry: PortForwardData) => void;
  selectedEntryId?: string;
}

function StatusBadge({ status }: { status: PortForwardData['status'] }) {
  return (
    <span
      className={cn(
        'font-mono text-xs font-semibold',
        status === 'Active' && 'text-green-400',
        status === 'Stopped' && 'text-zinc-500',
        status === 'Error' && 'text-red-400'
      )}
    >
      {status}
    </span>
  );
}

export const PortForwardingTable: React.FC<PortForwardingTableProps> = ({
  filteredData,
  selectedIds,
  onSelectAll,
  onSelectRow,
  onSelectEntry,
  selectedEntryId
}) => {
  const columns = useMemo<Column<PortForwardData>[]>(
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
        render: (row) => <span className="font-mono text-accent">{row.ns}</span>,
        className: 'font-mono text-accent',
        initialWidth: 110
      },
      {
        key: 'kind',
        header: 'Kind',
        render: (row) => <span className="font-mono text-zinc-400 text-[11px]">{row.kind}</span>,
        className: 'font-mono text-zinc-400 text-[11px]',
        initialWidth: 80
      },
      {
        key: 'podPort',
        header: 'Pod Port',
        render: (row) => <span className="font-mono text-zinc-400 text-[11px]">{row.podPort}</span>,
        className: 'font-mono text-zinc-400 text-[11px]',
        initialWidth: 80
      },
      {
        key: 'localPort',
        header: 'Local Port',
        render: (row) => (
          <span className="font-mono text-zinc-400 text-[11px]">{row.localPort}</span>
        ),
        className: 'font-mono text-zinc-400 text-[11px]',
        initialWidth: 85
      },
      {
        key: 'protocol',
        header: 'Protocol',
        render: (row) => (
          <span className="font-mono text-zinc-400 text-[11px]">{row.protocol}</span>
        ),
        className: 'font-mono text-zinc-400 text-[11px]',
        initialWidth: 80
      },
      {
        key: 'status',
        header: 'Status',
        render: (row) => <StatusBadge status={row.status} />,
        initialWidth: 80
      },
      {
        key: 'actions',
        header: (
          <div className="flex justify-center select-none">
            <MoreVertical className="size-3.5 text-zinc-555" />
          </div>
        ),
        render: (row) => (
          <div className="flex justify-center">
            <button
              onClick={async (e) => {
                e.stopPropagation();
                await window.kuberneter.stopPortForward(row.id);
                usePortForwardingStore.getState().removePortForward(row.id);
              }}
              title="Stop Port Forward"
              className="p-1 rounded hover:bg-surface-3 text-zinc-400 hover:text-red-400 cursor-pointer border-none bg-transparent"
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
      onRowClick={(row) => onSelectEntry(row)}
      selectedRowKey={selectedEntryId}
      emptyMessage="No Port Forwards match the search filters."
    />
  );
};
