import type React from 'react';
import { useMemo } from 'react';
import { KubeTable, type Column } from '../../kubeTable';
import { MoreVertical, AlertTriangle } from 'lucide-react';
import { type NodeData } from '../../../types/NodeData';

interface NodesTableProps {
  filteredData: NodeData[];
  selectedIds: Set<string>;
  onSelectAll: (checked: boolean) => void;
  onSelectRow: (id: string, checked: boolean) => void;
}

const MetricCell = ({ percent, capacity }: { percent: number; capacity: string }) => {
  let colorClass = 'text-emerald-500';
  if (percent >= 90) colorClass = 'text-red-500 font-semibold';
  else if (percent >= 75) colorClass = 'text-amber-500 font-medium';

  return (
    <div className="flex items-center gap-1 text-[11px]">
      <span className={colorClass}>{percent}%</span>
      <span className="text-zinc-500">/</span>
      <span className="text-zinc-300">{capacity}</span>
    </div>
  );
};

export const NodesTable: React.FC<NodesTableProps> = ({
  filteredData,
  selectedIds,
  onSelectAll,
  onSelectRow
}) => {
  const columns = useMemo<Column<NodeData>[]>(
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
        render: (row) => <span className="font-mono text-zinc-300 font-semibold">{row.name}</span>,
        className: 'font-mono text-zinc-300',
        initialWidth: 200
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
            title={
              row.hasWarning
                ? row.conditions !== 'Ready'
                  ? row.conditions
                  : 'Node is under pressure'
                : undefined
            }
          >
            {row.hasWarning && <AlertTriangle className="size-3.5 text-amber-500" />}
          </div>
        ),
        headerClassName: 'w-10 text-center',
        className: 'w-10 text-center',
        initialWidth: 40,
        resizable: false
      },
      {
        key: 'cpu',
        header: 'CPU',
        render: (row) => (
          <div title={`Raw Usage: ${row.rawCpu}`}>
            <MetricCell percent={row.cpuPercent} capacity={`${row.cpuCapacity} Cores`} />
          </div>
        ),
        initialWidth: 140
      },
      {
        key: 'memory',
        header: 'Memory',
        render: (row) => (
          <div title={`Raw Usage: ${row.rawMemory}`}>
            <MetricCell percent={row.memoryPercent} capacity={row.memoryCapacity} />
          </div>
        ),
        initialWidth: 140
      },
      {
        key: 'disk',
        header: 'Disk',
        render: (row) => (
          <div title={`Raw Capacity: ${row.rawDisk}`}>
            <MetricCell percent={row.diskPercent} capacity={row.diskCapacity} />
          </div>
        ),
        initialWidth: 140
      },
      {
        key: 'taints',
        header: 'Taints',
        render: (row) => <span className="font-mono text-[11px] text-zinc-400">{row.taints}</span>,
        className: 'text-zinc-400',
        initialWidth: 80
      },
      {
        key: 'roles',
        header: 'Roles',
        render: (row) => <span className="text-zinc-400 text-[11px]">{row.roles || ''}</span>,
        className: 'text-xs',
        initialWidth: 100
      },
      {
        key: 'version',
        header: 'Version',
        render: (row) => <span className="font-mono text-zinc-400 text-[11px]">{row.version}</span>,
        className: 'font-mono text-zinc-400',
        initialWidth: 100
      },
      {
        key: 'age',
        header: 'Age',
        render: (row) => <span className="text-zinc-500 font-mono text-[11px]">{row.age}</span>,
        className: 'text-zinc-500',
        initialWidth: 70
      },
      {
        key: 'conditions',
        header: 'Conditions',
        render: (row) => {
          return (
            <span className="text-[11px] font-medium text-zinc-400 select-none truncate">
              {row.conditions.includes('Ready') ? (
                <>
                  <span className="text-emerald-400">Ready</span>{' '}
                  {row.conditions.replace('Ready', '').trim()}
                </>
              ) : (
                row.conditions
              )}
            </span>
          );
        },
        className: 'text-xs truncate',
        initialWidth: 150
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
      emptyMessage="No nodes match the search filters."
    />
  );
};
