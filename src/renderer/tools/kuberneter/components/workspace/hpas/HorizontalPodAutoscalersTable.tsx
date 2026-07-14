import type React from 'react';
import { useMemo } from 'react';
import { KubeTable, type Column } from '../../kubeTable';
import { MoreVertical } from 'lucide-react';
import { type HorizontalPodAutoscalerData } from '../../../types/HorizontalPodAutoscalerData';

interface HorizontalPodAutoscalersTableProps {
  filteredData: HorizontalPodAutoscalerData[];
  selectedIds: Set<string>;
  onSelectAll: (checked: boolean) => void;
  onSelectRow: (id: string, checked: boolean) => void;
  onSelectHpa: (hpa: HorizontalPodAutoscalerData) => void;
  selectedHpaId?: string;
}

export const HorizontalPodAutoscalersTable: React.FC<HorizontalPodAutoscalersTableProps> = ({
  filteredData,
  selectedIds,
  onSelectAll,
  onSelectRow,
  onSelectHpa,
  selectedHpaId
}) => {
  const columns = useMemo<Column<HorizontalPodAutoscalerData>[]>(
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
        key: 'namespace',
        header: 'Namespace',
        render: (row) => (
          <span className="font-mono text-accent hover:underline cursor-pointer">{row.ns}</span>
        ),
        className: 'font-mono text-accent',
        initialWidth: 100
      },
      {
        key: 'metrics',
        header: 'Metrics',
        render: (row) => {
          const displayStr = row.metrics.map((m) => `${m.current} / ${m.target}`).join(', ') || '—';
          return (
            <span
              className="font-mono text-[11px] text-zinc-300 truncate block max-w-[180px]"
              title={displayStr}
            >
              {displayStr}
            </span>
          );
        },
        initialWidth: 150
      },
      {
        key: 'minPods',
        header: 'Min Pods',
        render: (row) => <span className="font-mono text-[11px] text-zinc-300">{row.minPods}</span>,
        initialWidth: 80
      },
      {
        key: 'maxPods',
        header: 'Max Pods',
        render: (row) => <span className="font-mono text-[11px] text-zinc-300">{row.maxPods}</span>,
        initialWidth: 80
      },
      {
        key: 'replicas',
        header: 'Replicas',
        render: (row) => (
          <span className="font-mono text-[11px] text-zinc-300">{row.replicas}</span>
        ),
        initialWidth: 80
      },
      {
        key: 'age',
        header: 'Age',
        render: (row) => <span className="text-zinc-500 font-mono text-[11px]">{row.age}</span>,
        className: 'text-zinc-500',
        initialWidth: 80
      },
      {
        key: 'status',
        header: 'Status',
        render: (row) => (
          <span className="font-sans text-[11px] text-zinc-400">{row.statusText || '—'}</span>
        ),
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
      variant="standard"
      className="flex-1"
      onRowClick={(row) => onSelectHpa(row)}
      selectedRowKey={selectedHpaId}
      emptyMessage="No HPAs match the search filters."
    />
  );
};
