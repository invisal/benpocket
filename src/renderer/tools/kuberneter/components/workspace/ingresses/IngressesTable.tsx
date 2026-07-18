import { Age } from '../../Age';
import type React from 'react';
import { useMemo } from 'react';
import { KubeTable, type Column } from '../../kubeTable';
import { MoreVertical } from 'lucide-react';
import { type IngressData } from '../../../types/IngressData';

interface IngressesTableProps {
  filteredData: IngressData[];
  selectedIds: Set<string>;
  onSelectAll: (checked: boolean) => void;
  onSelectRow: (id: string, checked: boolean) => void;
  onSelectIngress: (ing: IngressData) => void;
  onNamespaceClick: (ns: string) => void;
  selectedIngressId?: string;
}

export const IngressesTable: React.FC<IngressesTableProps> = ({
  filteredData,
  selectedIds,
  onSelectAll,
  onSelectRow,
  onSelectIngress,
  onNamespaceClick,
  selectedIngressId
}) => {
  const columns = useMemo<Column<IngressData>[]>(
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
        render: (row) => (
          <span
            onClick={(e) => {
              e.stopPropagation();
              onNamespaceClick(row.ns);
            }}
            className="font-mono text-accent hover:underline cursor-pointer"
          >
            {row.ns}
          </span>
        ),
        className: 'font-mono text-accent',
        initialWidth: 120
      },
      {
        key: 'loadBalancers',
        header: 'LoadBalancers',
        render: (row) => (
          <span className="font-mono text-zinc-400 text-[11px]">{row.loadBalancers}</span>
        ),
        initialWidth: 160
      },
      {
        key: 'rules',
        header: 'Rules',
        render: (row) => (
          <div className="flex flex-wrap gap-1 max-w-[400px]">
            {row.rules.map((r, idx) => (
              <span
                key={idx}
                className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-surface-3 border border-border/60 text-zinc-350"
              >
                {r.link} → {r.serviceName}:{r.servicePort}
              </span>
            ))}
          </div>
        ),
        initialWidth: 320
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
    [filteredData, selectedIds, onSelectAll, onSelectRow, onNamespaceClick]
  );

  return (
    <KubeTable
      columns={columns}
      data={filteredData}
      getRowKey={(row) => row.id}
      className="flex-1"
      onRowClick={(row) => onSelectIngress(row)}
      selectedRowKey={selectedIngressId}
      emptyMessage="No Ingresses match the search filters."
    />
  );
};
