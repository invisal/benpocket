import { Age } from '../../Age';
import type React from 'react';
import { useMemo } from 'react';
import { KubeTable, type Column } from '../../kubeTable';
import { MoreVertical, AlertTriangle } from 'lucide-react';
import { type NamespaceData } from '../../../types/NamespaceData';

interface NamespacesTableProps {
  filteredData: NamespaceData[];
  selectedIds: Set<string>;
  onSelectAll: (checked: boolean) => void;
  onSelectRow: (id: string, checked: boolean) => void;
  onSelectNs: (ns: NamespaceData) => void;
  selectedNsId?: string;
}

export const NamespacesTable: React.FC<NamespacesTableProps> = ({
  filteredData,
  selectedIds,
  onSelectAll,
  onSelectRow,
  onSelectNs,
  selectedNsId
}) => {
  const columns = useMemo<Column<NamespaceData>[]>(
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
        className: 'font-mono text-zinc-300 max-w-[200px] truncate',
        initialWidth: 200
      },
      {
        key: 'warning',
        header: (
          <div className="flex justify-center">
            <AlertTriangle className="size-3.5 text-zinc-500" />
          </div>
        ),
        render: (row) => {
          const hasWarning = row.status === 'Terminating';
          return (
            <div
              className="flex justify-center"
              title={hasWarning ? `Namespace is in Terminating status` : undefined}
            >
              {hasWarning && <AlertTriangle className="size-3.5 text-amber-500 animate-pulse" />}
            </div>
          );
        },
        headerClassName: 'w-10 text-center',
        className: 'w-10 text-center',
        initialWidth: 40,
        resizable: false
      },
      {
        key: 'labels',
        header: 'Labels',
        render: (row) => {
          const labelEntries = row.labels ? Object.entries(row.labels) : [];
          if (labelEntries.length === 0) {
            return <span className="text-zinc-650 font-mono text-[11px]">—</span>;
          }
          const tooltip = labelEntries.map(([k, v]) => `${k}=${v}`).join('\n');
          return (
            <span
              className="text-zinc-300 font-mono text-[11px] cursor-help hover:underline"
              title={tooltip}
            >
              {labelEntries.length} Label{labelEntries.length === 1 ? '' : 's'}
            </span>
          );
        },
        initialWidth: 360
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
        key: 'status',
        header: 'Status',
        render: (row) => {
          const isActive = row.status === 'Active';
          return (
            <span
              className={`font-semibold text-[11px] ${isActive ? 'text-emerald-500' : 'text-red-500'}`}
            >
              {row.status}
            </span>
          );
        },
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
              className="p-1 rounded hover:bg-surface-3 text-zinc-500 hover:text-strong cursor-pointer border-none bg-transparent"
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
      onRowClick={(row) => onSelectNs(row)}
      selectedRowKey={selectedNsId}
      emptyMessage="No Namespaces match the search filters."
    />
  );
};
