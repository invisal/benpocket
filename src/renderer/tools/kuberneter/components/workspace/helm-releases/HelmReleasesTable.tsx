import type React from 'react';
import { useMemo } from 'react';
import { Age } from '../../Age';
import { KubeTable, type Column } from '../../kubeTable';
import { MoreVertical } from 'lucide-react';
import { type HelmReleaseItem } from '../../../../../../preload/kuberneter/api';
import { parseReleaseChart } from './parseReleaseChart';
import { parseHelmTimestamp } from './parseHelmTimestamp';

function statusColor(status: string): string {
  const s = status.toLowerCase();
  if (s === 'deployed') return 'text-emerald-500';
  if (s === 'failed') return 'text-red-500';
  if (s.startsWith('pending')) return 'text-amber-500';
  if (s === 'uninstalling') return 'text-amber-500';
  return 'text-zinc-400';
}

interface HelmReleasesTableProps {
  filteredData: HelmReleaseItem[];
  selectedIds: Set<string>;
  onSelectAll: (checked: boolean) => void;
  onSelectRow: (id: string, checked: boolean) => void;
  onSelectRelease: (release: HelmReleaseItem) => void;
  onSelectNamespace?: (namespace: string) => void;
  selectedReleaseId?: string;
}

function releaseKey(release: HelmReleaseItem): string {
  return `${release.namespace}/${release.name}`;
}

export const HelmReleasesTable: React.FC<HelmReleasesTableProps> = ({
  filteredData,
  selectedIds,
  onSelectAll,
  onSelectRow,
  onSelectRelease,
  onSelectNamespace,
  selectedReleaseId
}) => {
  const columns = useMemo<Column<HelmReleaseItem>[]>(
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
            checked={selectedIds.has(releaseKey(row))}
            onChange={(e) => onSelectRow(releaseKey(row), e.target.checked)}
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
        className: 'font-mono text-zinc-300 max-w-[200px] truncate',
        initialWidth: 200
      },
      {
        key: 'namespace',
        header: 'Namespace',
        render: (row) => (
          <span
            className="text-accent font-mono text-[11px] truncate hover:underline cursor-pointer"
            title={row.namespace}
            onClick={(e) => {
              e.stopPropagation();
              onSelectNamespace?.(row.namespace);
            }}
          >
            {row.namespace}
          </span>
        ),
        sortValue: (row) => row.namespace,
        initialWidth: 140
      },
      {
        key: 'chart',
        header: 'Chart',
        render: (row) => {
          const { name } = parseReleaseChart(row.chart);
          return (
            <span className="text-zinc-350 font-mono text-[11px] truncate block" title={row.chart}>
              {name}
            </span>
          );
        },
        sortValue: (row) => parseReleaseChart(row.chart).name,
        initialWidth: 160
      },
      {
        key: 'revision',
        header: 'Revision',
        render: (row) => (
          <span className="text-zinc-400 font-mono text-[11px]">{row.revision}</span>
        ),
        sortValue: (row) => Number(row.revision) || 0,
        initialWidth: 90
      },
      {
        key: 'version',
        header: 'Version',
        render: (row) => {
          const { version } = parseReleaseChart(row.chart);
          return <span className="text-zinc-300 font-mono text-[11px]">{version || '—'}</span>;
        },
        sortValue: (row) => parseReleaseChart(row.chart).version,
        initialWidth: 100
      },
      {
        key: 'app_version',
        header: 'App Version',
        render: (row) => (
          <span className="text-zinc-400 font-mono text-[11px]">{row.app_version || '—'}</span>
        ),
        initialWidth: 100
      },
      {
        key: 'status',
        header: 'Status',
        render: (row) => (
          <span className={`font-semibold text-[11px] capitalize ${statusColor(row.status)}`}>
            {row.status}
          </span>
        ),
        sortValue: (row) => row.status,
        initialWidth: 100
      },
      {
        key: 'updated',
        header: 'Updated',
        render: (row) => (
          <span className="text-zinc-500 font-mono text-[11px]">
            <Age timestamp={parseHelmTimestamp(row.updated)} />
          </span>
        ),
        sortValue: (row) => new Date(parseHelmTimestamp(row.updated)).getTime() || 0,
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
        resizable: false,
        sortable: false
      }
    ],
    [filteredData, selectedIds, onSelectAll, onSelectRow, onSelectNamespace]
  );

  return (
    <KubeTable
      columns={columns}
      data={filteredData}
      getRowKey={(row) => releaseKey(row)}
      className="flex-1"
      onRowClick={(row) => onSelectRelease(row)}
      selectedRowKey={selectedReleaseId}
      emptyMessage="No Helm Releases match the search filters."
    />
  );
};
