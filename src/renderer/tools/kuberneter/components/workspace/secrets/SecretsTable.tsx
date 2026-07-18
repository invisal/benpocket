import { Age } from '../../Age';
import type React from 'react';
import { useMemo } from 'react';
import { KubeTable, type Column } from '../../kubeTable';
import { MoreVertical } from 'lucide-react';
import { cn } from 'cnfast';
import { type SecretData } from '../../../types/SecretData';

interface SecretsTableProps {
  filteredData: SecretData[];
  selectedIds: Set<string>;
  onSelectAll: (checked: boolean) => void;
  onSelectRow: (id: string, checked: boolean) => void;
  onSelectSecret: (secret: SecretData) => void;
  selectedSecretId?: string;
}

export const SecretsTable: React.FC<SecretsTableProps> = ({
  filteredData,
  selectedIds,
  onSelectAll,
  onSelectRow,
  onSelectSecret,
  selectedSecretId
}) => {
  const columns = useMemo<Column<SecretData>[]>(
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
          <span className="font-mono text-accent hover:underline cursor-pointer">{row.ns}</span>
        ),
        className: 'font-mono text-accent',
        initialWidth: 100
      },
      {
        key: 'labels',
        header: 'Labels',
        render: (row) => {
          const labelsArr = row.labels ? Object.entries(row.labels) : [];
          const labelsStr =
            labelsArr.length > 0 ? labelsArr.map(([k, v]) => `${k}=${v}`).join(', ') : '—';
          return (
            <span
              className={cn(
                'font-sans text-[11px] truncate block max-w-[200px]',
                labelsArr.length > 0 ? 'text-zinc-300' : 'text-zinc-550'
              )}
              title={labelsStr}
            >
              {labelsStr}
            </span>
          );
        },
        initialWidth: 200
      },
      {
        key: 'keys',
        header: 'Keys',
        render: (row) => {
          const keysStr = row.keysList && row.keysList.length > 0 ? row.keysList.join(', ') : '—';
          return (
            <span
              className={cn(
                'font-mono text-[11px] truncate block max-w-[220px]',
                row.keysList && row.keysList.length > 0 ? 'text-zinc-300' : 'text-zinc-500'
              )}
              title={keysStr}
            >
              {keysStr}
            </span>
          );
        },
        initialWidth: 220
      },
      {
        key: 'type',
        header: 'Type',
        render: (row) => (
          <span
            className="font-sans text-[11px] text-zinc-400 truncate block max-w-[150px]"
            title={row.type}
          >
            {row.type}
          </span>
        ),
        initialWidth: 150
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
        initialWidth: 80
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
      onRowClick={(row) => onSelectSecret(row)}
      selectedRowKey={selectedSecretId}
      emptyMessage="No secrets match the search filters."
    />
  );
};
