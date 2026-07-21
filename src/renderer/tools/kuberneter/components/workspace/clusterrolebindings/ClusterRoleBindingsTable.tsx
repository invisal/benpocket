import { Age } from '../../Age';
import type React from 'react';
import { useMemo } from 'react';
import { KubeTable, type Column } from '../../kubeTable';
import { MoreVertical, AlertTriangle } from 'lucide-react';
import { type ClusterRoleBindingData } from '../../../types/ClusterRoleBindingData';

interface ClusterRoleBindingsTableProps {
  filteredData: ClusterRoleBindingData[];
  selectedIds: Set<string>;
  onSelectAll: (checked: boolean) => void;
  onSelectRow: (id: string, checked: boolean) => void;
  onSelectBinding: (binding: ClusterRoleBindingData) => void;
  selectedBindingId?: string;
}

export const ClusterRoleBindingsTable: React.FC<ClusterRoleBindingsTableProps> = ({
  filteredData,
  selectedIds,
  onSelectAll,
  onSelectRow,
  onSelectBinding,
  selectedBindingId
}) => {
  const columns = useMemo<Column<ClusterRoleBindingData>[]>(
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
        className: 'font-mono text-zinc-300 max-w-[320px] truncate',
        initialWidth: 320
      },
      {
        key: 'warning',
        header: (
          <div className="flex justify-center">
            <AlertTriangle className="size-3.5 text-zinc-500" />
          </div>
        ),
        render: () => {
          return (
            <div className="flex justify-center">
              {/* No warnings for clusterrolebindings in mockup */}
            </div>
          );
        },
        headerClassName: 'w-10 text-center',
        className: 'w-10 text-center',
        initialWidth: 40,
        resizable: false
      },
      {
        key: 'bindings',
        header: 'Bindings',
        render: (row) => {
          const subjectsList = row.subjects || [];
          if (subjectsList.length === 0) {
            return <span className="text-zinc-650 font-mono text-[11px]">—</span>;
          }
          const tooltip = subjectsList.map((s) => `${s.kind}: ${s.name}`).join('\n');
          const subjectsStr = subjectsList.map((s) => s.name).join(', ');
          return (
            <span
              className="text-zinc-300 font-mono text-[11px] truncate block max-w-100"
              title={tooltip}
            >
              {subjectsStr}
            </span>
          );
        },
        className: 'font-mono text-zinc-300 max-w-[400px] truncate',
        initialWidth: 400
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
      onRowClick={(row) => onSelectBinding(row)}
      selectedRowKey={selectedBindingId}
      emptyMessage="No Cluster Role Bindings match the search filters."
    />
  );
};
