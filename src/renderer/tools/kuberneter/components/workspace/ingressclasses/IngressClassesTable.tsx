import { Age } from '../../Age';
import type React from 'react';
import { useMemo } from 'react';
import { KubeTable, type Column } from '../../kubeTable';
import { MoreVertical, Star } from 'lucide-react';
import { type IngressClassData } from '../../../types/IngressClassData';

interface IngressClassesTableProps {
  filteredData: IngressClassData[];
  selectedIds: Set<string>;
  onSelectAll: (checked: boolean) => void;
  onSelectRow: (id: string, checked: boolean) => void;
  onSelectIngressClass: (ic: IngressClassData) => void;
  selectedIngressClassId?: string;
}

export const IngressClassesTable: React.FC<IngressClassesTableProps> = ({
  filteredData,
  selectedIds,
  onSelectAll,
  onSelectRow,
  onSelectIngressClass,
  selectedIngressClassId
}) => {
  const columns = useMemo<Column<IngressClassData>[]>(
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
        key: 'default',
        header: (
          <div className="flex justify-center">
            <Star className="size-3.5 text-zinc-600" />
          </div>
        ),
        render: (row) => (
          <div className="flex justify-center">
            {row.isDefault ? (
              <Star className="size-3.5 fill-yellow-400 text-yellow-400" />
            ) : (
              <Star className="size-3.5 text-zinc-600" />
            )}
          </div>
        ),
        headerClassName: 'w-10 text-center',
        className: 'w-10 text-center',
        initialWidth: 40,
        resizable: false,
        sortable: false
      },
      {
        key: 'namespace',
        header: 'Namespace',
        render: (row) => (
          <span className="font-mono text-zinc-500">{(row as { ns?: string }).ns || '—'}</span>
        ),
        className: 'font-mono text-zinc-500',
        initialWidth: 100
      },
      {
        key: 'controller',
        header: 'Controller',
        render: (row) => (
          <span className="font-mono text-zinc-400 text-[11px] truncate" title={row.controller}>
            {row.controller || '—'}
          </span>
        ),
        initialWidth: 220
      },
      {
        key: 'apiGroup',
        header: 'API Group',
        render: (row) => (
          <span className="font-mono text-zinc-400 text-[11px]">
            {row.parametersApiGroup || '—'}
          </span>
        ),
        initialWidth: 160
      },
      {
        key: 'scope',
        header: 'Scope',
        render: (row) => (
          <span className="font-mono text-zinc-400 text-[11px]">{row.parametersScope || '—'}</span>
        ),
        initialWidth: 100
      },
      {
        key: 'kind',
        header: 'Kind',
        render: (row) => (
          <span className="font-mono text-zinc-400 text-[11px] truncate" title={row.parametersKind}>
            {row.parametersKind || '—'}
          </span>
        ),
        initialWidth: 120
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
      onRowClick={(row) => onSelectIngressClass(row)}
      selectedRowKey={selectedIngressClassId}
      emptyMessage="No Ingress Classes match the search filters."
    />
  );
};
