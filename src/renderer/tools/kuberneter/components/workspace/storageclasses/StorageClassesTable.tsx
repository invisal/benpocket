import { Age } from '../../Age';
import type React from 'react';
import { useMemo } from 'react';
import { KubeTable, type Column } from '../../kubeTable';
import { MoreVertical, AlertTriangle } from 'lucide-react';
import { type StorageClassData } from '../../../types/StorageClassData';

interface StorageClassesTableProps {
  filteredData: StorageClassData[];
  selectedIds: Set<string>;
  onSelectAll: (checked: boolean) => void;
  onSelectRow: (id: string, checked: boolean) => void;
  onSelectSc: (sc: StorageClassData) => void;
  selectedScId?: string;
}

export const StorageClassesTable: React.FC<StorageClassesTableProps> = ({
  filteredData,
  selectedIds,
  onSelectAll,
  onSelectRow,
  onSelectSc,
  selectedScId
}) => {
  const columns = useMemo<Column<StorageClassData>[]>(
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
        className: 'font-mono text-zinc-300 max-w-[240px] truncate',
        initialWidth: 260
      },
      {
        key: 'warning',
        header: (
          <div className="flex justify-center">
            <AlertTriangle className="size-3.5 text-zinc-500" />
          </div>
        ),
        render: () => {
          // Typically StorageClasses are always active and don't fail, but we'll include the column for layout consistency.
          return <div className="flex justify-center" />;
        },
        headerClassName: 'w-10 text-center',
        className: 'w-10 text-center',
        initialWidth: 40,
        resizable: false
      },
      {
        key: 'provisioner',
        header: 'Provisioner',
        render: (row) => (
          <span className="font-mono text-zinc-450 text-[11px] truncate" title={row.provisioner}>
            {row.provisioner}
          </span>
        ),
        className: 'font-mono truncate max-w-[240px]',
        initialWidth: 240
      },
      {
        key: 'reclaimPolicy',
        header: 'Reclaim Policy',
        render: (row) => <span className="text-zinc-300 text-[11px]">{row.reclaimPolicy}</span>,
        initialWidth: 140
      },
      {
        key: 'default',
        header: 'Default',
        render: (row) => (
          <span className="text-zinc-400 font-semibold text-[11px]">
            {row.isDefault ? 'Yes' : ''}
          </span>
        ),
        initialWidth: 100
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
      onRowClick={(row) => onSelectSc(row)}
      selectedRowKey={selectedScId}
      emptyMessage="No Storage Classes match the search filters."
    />
  );
};
