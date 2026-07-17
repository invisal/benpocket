import type React from 'react';
import { useMemo } from 'react';
import { KubeTable, type Column } from '../../kubeTable';
import { MoreVertical } from 'lucide-react';
import { type ValidatingWebhookConfigurationData } from '../../../types/ValidatingWebhookConfigurationData';

interface ValidatingWebhooksTableProps {
  filteredData: ValidatingWebhookConfigurationData[];
  selectedIds: Set<string>;
  onSelectAll: (checked: boolean) => void;
  onSelectRow: (id: string, checked: boolean) => void;
  onSelectWebhook: (webhook: ValidatingWebhookConfigurationData) => void;
  selectedWebhookId?: string;
}

export const ValidatingWebhooksTable: React.FC<ValidatingWebhooksTableProps> = ({
  filteredData,
  selectedIds,
  onSelectAll,
  onSelectRow,
  onSelectWebhook,
  selectedWebhookId
}) => {
  const columns = useMemo<Column<ValidatingWebhookConfigurationData>[]>(
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
        className: 'font-mono text-zinc-300 max-w-[320px] truncate',
        initialWidth: 320
      },
      {
        key: 'webhooks',
        header: 'Webhooks',
        render: (row) => (
          <span className="font-mono text-[11px] text-zinc-300">{row.webhooksCount}</span>
        ),
        initialWidth: 150
      },
      {
        key: 'age',
        header: 'Age',
        render: (row) => <span className="text-zinc-500 font-mono text-[11px]">{row.age}</span>,
        className: 'text-zinc-500',
        initialWidth: 120
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
      onRowClick={(row) => onSelectWebhook(row)}
      selectedRowKey={selectedWebhookId}
      emptyMessage="No Validating Webhook Configurations match the search filters."
    />
  );
};
