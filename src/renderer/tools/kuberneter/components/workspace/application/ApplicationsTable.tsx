import type React from 'react';
import { useMemo } from 'react';
import { KubeTable, type Column } from '../../kubeTable';
import { MoreVertical } from 'lucide-react';
import { cn } from 'cnfast';
import { type ApplicationData } from '../../../types/ApplicationData';

interface ApplicationsTableProps {
  filteredData: ApplicationData[];
  selectedIds: Set<string>;
  onSelectAll: (checked: boolean) => void;
  onSelectRow: (id: string, checked: boolean) => void;
}

export const ApplicationsTable: React.FC<ApplicationsTableProps> = ({
  filteredData,
  selectedIds,
  onSelectAll,
  onSelectRow
}) => {
  const columns = useMemo<Column<ApplicationData>[]>(
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
        key: 'instance',
        header: 'Instance',
        render: (row) => (
          <span className="font-mono text-zinc-300 font-semibold">{row.instance}</span>
        ),
        className: 'font-mono text-zinc-300',
        initialWidth: 180
      },
      {
        key: 'application',
        header: 'Application',
        render: (row) => <span className="font-sans text-zinc-200">{row.application}</span>,
        className: 'text-zinc-200',
        initialWidth: 160
      },
      {
        key: 'namespace',
        header: 'Namespace',
        render: (row) => (
          <span className="font-mono text-[10px] text-zinc-550">{row.namespace}</span>
        ),
        className: 'font-mono text-zinc-550',
        initialWidth: 160
      },
      {
        key: 'managedBy',
        header: 'Managed By',
        render: (row) =>
          row.managedBy ? (
            <span className="text-zinc-400 text-[11px]">{row.managedBy}</span>
          ) : (
            <span className="text-zinc-600">—</span>
          ),
        className: 'text-xs',
        initialWidth: 100
      },
      {
        key: 'version',
        header: 'Version',
        render: (row) => (
          <span className="font-mono text-zinc-400">
            {row.version || <span className="text-zinc-600">—</span>}
          </span>
        ),
        className: 'font-mono text-zinc-400',
        initialWidth: 80
      },
      {
        key: 'age',
        header: 'Age',
        render: (row) => <span className="text-zinc-500 font-mono text-[11px]">{row.age}</span>,
        className: 'text-zinc-500',
        initialWidth: 70
      },
      {
        key: 'status',
        header: 'Status',
        render: (row) => {
          const isRunning = row.status === 'Running';
          return (
            <span
              className={cn(
                'text-[11px] font-medium select-none',
                isRunning ? 'text-emerald-400' : 'text-amber-400'
              )}
            >
              {row.status}
            </span>
          );
        },
        className: 'text-xs',
        initialWidth: 80
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
      variant="standard"
      className="flex-1"
      emptyMessage="No applications match the search filters."
    />
  );
};
