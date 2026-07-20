import type React from 'react';
import { useMemo, useState } from 'react';
import { KubeTable, type Column } from '../../kubeTable';
import { MoreVertical, Package } from 'lucide-react';
import { type HelmChartItem } from '../../../../../../preload/kuberneter/api';

const ChartIcon: React.FC<{ iconUrl?: string }> = ({ iconUrl }) => {
  const [imageError, setImageError] = useState(false);

  if (iconUrl && !imageError) {
    return (
      <img
        src={iconUrl}
        className="size-full object-contain"
        alt=""
        onError={() => setImageError(true)}
      />
    );
  }
  return <Package className="size-4 text-zinc-500" />;
};

interface HelmChartsTableProps {
  filteredData: HelmChartItem[];
  selectedIds: Set<string>;
  onSelectAll: (checked: boolean) => void;
  onSelectRow: (id: string, checked: boolean) => void;
  onSelectChart: (chart: HelmChartItem) => void;
  selectedChartName?: string;
  iconMap: Record<string, string>;
}

export const HelmChartsTable: React.FC<HelmChartsTableProps> = ({
  filteredData,
  selectedIds,
  onSelectAll,
  onSelectRow,
  onSelectChart,
  selectedChartName,
  iconMap
}) => {
  const columns = useMemo<Column<HelmChartItem>[]>(
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
            checked={selectedIds.has(row.name)}
            onChange={(e) => onSelectRow(row.name, e.target.checked)}
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
        render: (row) => {
          const parts = row.name.split('/');
          const chartName = parts[1] || row.name;
          const iconUrl = iconMap[row.name];

          return (
            <div className="flex items-center gap-2 overflow-hidden py-0.5">
              <div className="size-5 shrink-0 flex items-center justify-center overflow-hidden">
                <ChartIcon iconUrl={iconUrl} />
              </div>
              <span
                className="font-mono text-zinc-350 font-semibold truncate hover:underline cursor-pointer"
                title={row.name}
              >
                {chartName}
              </span>
            </div>
          );
        },
        className: 'font-mono text-zinc-300 max-w-[200px] truncate',
        initialWidth: 200
      },
      {
        key: 'description',
        header: 'Description',
        render: (row) => (
          <span className="text-zinc-400 text-[11px] truncate block" title={row.description}>
            {row.description}
          </span>
        ),
        initialWidth: 360
      },
      {
        key: 'version',
        header: 'Version',
        render: (row) => <span className="text-zinc-300 font-mono text-[11px]">{row.version}</span>,
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
        key: 'repository',
        header: 'Repository',
        render: (row) => {
          const parts = row.name.split('/');
          const repo = parts[0] || 'stable';
          return <span className="text-zinc-400 font-mono text-[11px]">{repo}</span>;
        },
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
    [filteredData, selectedIds, onSelectAll, onSelectRow, iconMap]
  );

  return (
    <KubeTable
      columns={columns}
      data={filteredData}
      getRowKey={(row) => row.name}
      className="flex-1"
      onRowClick={(row) => onSelectChart(row)}
      selectedRowKey={selectedChartName}
      emptyMessage="No Helm Charts match the search filters."
    />
  );
};
