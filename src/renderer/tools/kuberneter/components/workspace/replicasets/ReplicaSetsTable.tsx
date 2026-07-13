import type React from 'react';
import { useMemo } from 'react';
import { KubeTable, type Column } from '../../kubeTable';
import { MoreVertical, AlertTriangle } from 'lucide-react';
import { type ReplicaSetData } from '../../../types/ReplicaSetData';

interface ReplicaSetsTableProps {
  filteredData: ReplicaSetData[];
  selectedIds: Set<string>;
  onSelectAll: (checked: boolean) => void;
  onSelectRow: (id: string, checked: boolean) => void;
  onSelectReplicaSet: (rs: ReplicaSetData) => void;
  selectedReplicaSetId?: string;
}

export const ReplicaSetsTable: React.FC<ReplicaSetsTableProps> = ({
  filteredData,
  selectedIds,
  onSelectAll,
  onSelectRow,
  onSelectReplicaSet,
  selectedReplicaSetId
}) => {
  const columns = useMemo<Column<ReplicaSetData>[]>(
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
        resizable: false
      },
      {
        key: 'name',
        header: 'Name',
        render: (row) => (
          <span
            className="font-mono text-zinc-300 font-semibold truncate hover:underline"
            title={row.name}
          >
            {row.name}
          </span>
        ),
        className: 'font-mono text-zinc-300 max-w-[280px] truncate',
        initialWidth: 280
      },
      {
        key: 'warning',
        header: (
          <div className="flex justify-center">
            <AlertTriangle className="size-3.5 text-zinc-550" />
          </div>
        ),
        render: (row) => (
          <div
            className="flex justify-center"
            title={row.hasWarning ? `ReplicaSet has unready replicas` : undefined}
          >
            {row.hasWarning && <AlertTriangle className="size-3.5 text-amber-500 animate-pulse" />}
          </div>
        ),
        headerClassName: 'w-10 text-center',
        className: 'w-10 text-center',
        initialWidth: 40,
        resizable: false
      },
      {
        key: 'namespace',
        header: 'Namespace',
        render: (row) => (
          <span className="font-mono text-accent hover:underline cursor-pointer">{row.ns}</span>
        ),
        className: 'font-mono text-accent',
        initialWidth: 140
      },
      {
        key: 'desired',
        header: 'Desired',
        render: (row) => <span className="font-mono text-[11px] text-zinc-300">{row.desired}</span>,
        initialWidth: 90
      },
      {
        key: 'current',
        header: 'Current',
        render: (row) => <span className="font-mono text-[11px] text-zinc-350">{row.current}</span>,
        initialWidth: 90
      },
      {
        key: 'ready',
        header: 'Ready',
        render: (row) => <span className="font-mono text-[11px] text-zinc-350">{row.ready}</span>,
        initialWidth: 90
      },
      {
        key: 'age',
        header: 'Age',
        render: (row) => <span className="text-zinc-555 font-mono text-[11px]">{row.age}</span>,
        className: 'text-zinc-555',
        initialWidth: 100
      },
      {
        key: 'actions',
        header: (
          <div className="flex justify-center select-none">
            <MoreVertical className="size-3.5 text-zinc-550" />
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
      variant="modern"
      className="flex-1"
      onRowClick={(row) => onSelectReplicaSet(row)}
      selectedRowKey={selectedReplicaSetId}
      emptyMessage="No Replica Sets match the search filters."
    />
  );
};
