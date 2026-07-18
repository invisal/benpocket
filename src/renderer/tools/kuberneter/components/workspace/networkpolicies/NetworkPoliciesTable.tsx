import type React from 'react';
import { useMemo } from 'react';
import { KubeTable, type Column } from '../../kube-table';
import { MoreVertical, AlertTriangle } from 'lucide-react';
import { type NetworkPolicyData } from '../../../types/NetworkPolicyData';
import { Age } from '../../Age';

interface NetworkPoliciesTableProps {
  filteredData: NetworkPolicyData[];
  selectedIds: Set<string>;
  onSelectAll: (checked: boolean) => void;
  onSelectRow: (id: string, checked: boolean) => void;
  onSelectPolicy: (policy: NetworkPolicyData) => void;
  onNamespaceClick: (ns: string) => void;
  selectedPolicyId?: string;
}

export const NetworkPoliciesTable: React.FC<NetworkPoliciesTableProps> = ({
  filteredData,
  selectedIds,
  onSelectAll,
  onSelectRow,
  onSelectPolicy,
  onNamespaceClick,
  selectedPolicyId
}) => {
  const columns = useMemo<Column<NetworkPolicyData>[]>(
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
        initialWidth: 240
      },
      {
        key: 'warning',
        header: (
          <div className="flex justify-center select-none" title="Warnings">
            <AlertTriangle className="size-3.5 text-zinc-555" />
          </div>
        ),
        render: (row) => (
          <div className="flex justify-center">
            {row.hasWarning ? (
              <span title={row.warningReason || 'Network Policy has warnings.'}>
                <AlertTriangle className="size-3.5 text-amber-500 fill-amber-500/10" />
              </span>
            ) : null}
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
        initialWidth: 140
      },
      {
        key: 'policyTypes',
        header: 'Policy Types',
        render: (row) => (
          <span className="text-zinc-400 font-mono text-[11px]">{row.policyTypesStr}</span>
        ),
        initialWidth: 200
      },
      {
        key: 'age',
        header: 'Age',
        render: (row) => (
          <span className="text-zinc-500 font-mono text-[11px]">
            <Age timestamp={row.creationTimestamp} />
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
      onRowClick={(row) => onSelectPolicy(row)}
      selectedRowKey={selectedPolicyId}
      emptyMessage="No Network Policies match the search filters."
    />
  );
};
