import React, { useMemo } from 'react';
import { KubeTable, Column } from '../../kubeTable';
import { MoreVertical, AlertTriangle } from 'lucide-react';
import { CronJobData } from '../../../types/CronJobData';

interface CronJobsTableProps {
  filteredData: CronJobData[];
  selectedIds: Set<string>;
  onSelectAll: (checked: boolean) => void;
  onSelectRow: (id: string, checked: boolean) => void;
  onSelectCronJob: (cj: CronJobData) => void;
  selectedCronJobId?: string;
}

export const CronJobsTable: React.FC<CronJobsTableProps> = ({
  filteredData,
  selectedIds,
  onSelectAll,
  onSelectRow,
  onSelectCronJob,
  selectedCronJobId
}) => {
  const columns = useMemo<Column<CronJobData>[]>(
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
        className: 'font-mono text-zinc-300 max-w-[240px] truncate',
        initialWidth: 240
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
            title={row.hasWarning ? 'Suspended cron job with active jobs' : undefined}
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
        initialWidth: 130
      },
      {
        key: 'schedule',
        header: 'Schedule',
        render: (row) => (
          <span className="font-mono text-[11px] text-zinc-300 bg-surface-2 border border-border-dark/40 rounded px-1.5 py-0.5">
            {row.schedule}
          </span>
        ),
        initialWidth: 130
      },
      {
        key: 'suspend',
        header: 'Suspend',
        render: (row) => (
          <span
            className={`font-mono text-[11px] ${row.suspend ? 'text-amber-400' : 'text-zinc-500'}`}
          >
            {String(row.suspend)}
          </span>
        ),
        initialWidth: 80
      },
      {
        key: 'active',
        header: 'Active',
        render: (row) => <span className="font-mono text-[11px] text-zinc-400">{row.active}</span>,
        initialWidth: 65
      },
      {
        key: 'lastSchedule',
        header: 'Last schedule',
        render: (row) => (
          <span className="text-zinc-555 font-mono text-[11px]">{row.lastSchedule}</span>
        ),
        initialWidth: 115
      },
      {
        key: 'nextExecution',
        header: 'Next execution',
        render: (row) => (
          <span
            className={`font-mono text-[11px] ${row.nextExecution === 'N/A' ? 'text-zinc-600' : 'text-zinc-400'}`}
          >
            {row.nextExecution}
          </span>
        ),
        initialWidth: 115
      },
      {
        key: 'timeZone',
        header: 'Time zone',
        render: (row) => (
          <span className="font-mono text-[11px] text-zinc-500">{row.timeZone}</span>
        ),
        initialWidth: 100
      },
      {
        key: 'age',
        header: 'Age',
        render: (row) => <span className="text-zinc-555 font-mono text-[11px]">{row.age}</span>,
        className: 'text-zinc-555',
        initialWidth: 90
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
      onRowClick={(row) => onSelectCronJob(row)}
      selectedRowKey={selectedCronJobId}
      emptyMessage="No Cron Jobs match the search filters."
    />
  );
};
