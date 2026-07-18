import { Age } from '../../Age';
import type React from 'react';
import { useMemo } from 'react';
import { KubeTable, type Column } from '../../kubeTable';
import { MoreVertical, AlertTriangle } from 'lucide-react';
import { cn } from 'cnfast';
import { type PodData } from '../../../types/PodData';

interface PodsTableProps {
  filteredData: PodData[];
  selectedIds: Set<string>;
  onSelectAll: (checked: boolean) => void;
  onSelectRow: (id: string, checked: boolean) => void;
  onSelectPod: (pod: PodData) => void;
  selectedPodId?: string;
}

export const PodsTable: React.FC<PodsTableProps> = ({
  filteredData,
  selectedIds,
  onSelectAll,
  onSelectRow,
  onSelectPod,
  selectedPodId
}) => {
  const columns = useMemo<Column<PodData>[]>(
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
            className="font-mono text-zinc-300 font-semibold truncate hover:underline"
            title={row.name}
          >
            {row.name}
          </span>
        ),
        className: 'font-mono text-zinc-300 max-w-[220px] truncate',
        initialWidth: 220
      },
      {
        key: 'warning',
        header: (
          <div className="flex justify-center">
            <AlertTriangle className="size-3.5 text-zinc-500" />
          </div>
        ),
        render: (row) => (
          <div
            className="flex justify-center"
            title={row.hasWarning ? `Pod has issue: ${row.status}` : undefined}
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
        initialWidth: 100
      },
      {
        key: 'cpu',
        header: 'CPU',
        render: (row) => {
          const isNA = row.cpu === 'N/A';
          return (
            <span className={cn('font-mono text-[11px]', isNA ? 'text-zinc-500' : 'text-zinc-300')}>
              {row.cpu}
            </span>
          );
        },
        initialWidth: 70
      },
      {
        key: 'memory',
        header: 'Memory',
        render: (row) => {
          const isNA = row.memory === 'N/A';
          return (
            <span className={cn('font-mono text-[11px]', isNA ? 'text-zinc-500' : 'text-zinc-300')}>
              {row.memory}
            </span>
          );
        },
        initialWidth: 90
      },
      {
        key: 'container',
        header: 'Container',
        render: (row) => (
          <div className="flex items-center gap-1">
            {row.containers.map((c, idx) => (
              <div
                key={idx}
                title={`${c.name}: ${c.ready ? 'Ready' : 'Not Ready'}`}
                className={cn(
                  'w-2 h-2.5 rounded-sm transition-all',
                  c.ready ? 'bg-emerald-500 shadow-emerald-500/10' : 'bg-red-500 shadow-red-500/10'
                )}
              />
            ))}
          </div>
        ),
        initialWidth: 90
      },
      {
        key: 'restarts',
        header: 'Restarts',
        render: (row) => (
          <span className="font-mono text-[11px] text-zinc-400 text-center block">
            {row.restarts}
          </span>
        ),
        initialWidth: 70
      },
      {
        key: 'controlledBy',
        header: 'Controlled By',
        render: (row) => (
          <span className="font-sans text-accent hover:underline cursor-pointer text-[11px]">
            {row.controlledBy || <span className="text-zinc-650">—</span>}
          </span>
        ),
        initialWidth: 100
      },
      {
        key: 'node',
        header: 'Node',
        render: (row) => (
          <span
            className="font-mono text-accent hover:underline cursor-pointer text-[11px] truncate max-w-[120px]"
            title={row.node}
          >
            {row.node || <span className="text-zinc-650">—</span>}
          </span>
        ),
        initialWidth: 120
      },
      {
        key: 'qos',
        header: 'QoS',
        render: (row) => (
          <span className="font-sans text-zinc-400 text-[11px]">
            {row.qos || <span className="text-zinc-650">—</span>}
          </span>
        ),
        initialWidth: 90
      },
      {
        key: 'status',
        header: 'Status',
        render: (row) => {
          const isRunning = row.status === 'Running' || row.status === 'Succeeded';
          const isPending = row.status === 'Pending';
          return (
            <span
              className={cn(
                'text-[11px] font-medium select-none',
                isRunning ? 'text-emerald-400' : isPending ? 'text-amber-400' : 'text-red-400'
              )}
            >
              {row.status}
            </span>
          );
        },
        initialWidth: 90
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
        initialWidth: 70
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
      className="flex-1"
      onRowClick={(row) => onSelectPod(row)}
      selectedRowKey={selectedPodId}
      emptyMessage="No pods match the search filters."
    />
  );
};
