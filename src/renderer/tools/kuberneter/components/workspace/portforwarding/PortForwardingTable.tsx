import type React from 'react';
import { useMemo, useState } from 'react';
import { KubeTable, type Column } from '../../kubeTable';
import { MoreVertical, ExternalLink, Copy, Check } from 'lucide-react';
import { type PortForwardData } from '../../../types/PortForwardData';
import { usePortForwardingStore } from '../../../store/portForwarding.store';
import { cn } from 'cnfast';

interface PortForwardingTableProps {
  filteredData: PortForwardData[];
  selectedIds: Set<string>;
  onSelectAll: (checked: boolean) => void;
  onSelectRow: (id: string, checked: boolean) => void;
  onSelectEntry: (entry: PortForwardData) => void;
  selectedEntryId?: string;
}

function StatusBadge({ status }: { status: PortForwardData['status'] }) {
  return (
    <span
      className={cn(
        'font-mono text-xs font-semibold',
        status === 'Active' && 'text-green-400',
        status === 'Stopped' && 'text-zinc-500',
        status === 'Error' && 'text-red-400'
      )}
    >
      {status}
    </span>
  );
}

function TunnelTypeBadge({ type }: { type?: PortForwardData['tunnelType'] }) {
  if (type === 'cloudflare') {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/15 text-amber-300 border border-amber-500/30">
        Cloudflare
      </span>
    );
  }
  if (type === 'ngrok') {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-500/15 text-blue-300 border border-blue-500/30">
        ngrok
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-surface-3 text-muted-foreground border border-border/40">
      Local
    </span>
  );
}

function UrlCell({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="flex items-center gap-1.5 max-w-[240px] group">
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="font-mono text-accent text-[11px] truncate hover:underline flex items-center gap-1"
        title={url}
      >
        <span className="truncate">{url}</span>
        <ExternalLink className="size-3 shrink-0 opacity-60 group-hover:opacity-100" />
      </a>
      <button
        type="button"
        onClick={handleCopy}
        className="p-0.5 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity bg-transparent border-none cursor-pointer shrink-0"
        title="Copy URL"
      >
        {copied ? <Check className="size-3 text-green-400" /> : <Copy className="size-3" />}
      </button>
    </div>
  );
}

export const PortForwardingTable: React.FC<PortForwardingTableProps> = ({
  filteredData,
  selectedIds,
  onSelectAll,
  onSelectRow,
  onSelectEntry,
  selectedEntryId
}) => {
  const columns = useMemo<Column<PortForwardData>[]>(
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
        className: 'font-mono text-zinc-300 max-w-[180px] truncate',
        initialWidth: 180
      },
      {
        key: 'namespace',
        header: 'Namespace',
        render: (row) => <span className="font-mono text-accent">{row.ns}</span>,
        className: 'font-mono text-accent',
        initialWidth: 100
      },
      {
        key: 'kind',
        header: 'Kind',
        render: (row) => <span className="font-mono text-zinc-400 text-[11px]">{row.kind}</span>,
        className: 'font-mono text-zinc-400 text-[11px]',
        initialWidth: 70
      },
      {
        key: 'podPort',
        header: 'Pod Port',
        render: (row) => <span className="font-mono text-zinc-400 text-[11px]">{row.podPort}</span>,
        className: 'font-mono text-zinc-400 text-[11px]',
        initialWidth: 75
      },
      {
        key: 'localPort',
        header: 'Local Port',
        render: (row) => (
          <span className="font-mono text-zinc-400 text-[11px]">{row.localPort}</span>
        ),
        className: 'font-mono text-zinc-400 text-[11px]',
        initialWidth: 80
      },
      {
        key: 'tunnelType',
        header: 'Type',
        render: (row) => <TunnelTypeBadge type={row.tunnelType} />,
        initialWidth: 95
      },
      {
        key: 'url',
        header: 'URL',
        render: (row) => <UrlCell url={row.url} />,
        initialWidth: 220
      },
      {
        key: 'status',
        header: 'Status',
        render: (row) => <StatusBadge status={row.status} />,
        initialWidth: 75
      },
      {
        key: 'actions',
        header: (
          <div className="flex justify-center select-none">
            <MoreVertical className="size-3.5 text-zinc-555" />
          </div>
        ),
        render: (row) => (
          <div className="flex justify-center">
            <button
              onClick={async (e) => {
                e.stopPropagation();
                await window.kuberneter.stopPortForward(row.id);
                usePortForwardingStore.getState().removePortForward(row.id);
              }}
              title="Stop Port Forward"
              className="p-1 rounded hover:bg-surface-3 text-zinc-400 hover:text-red-400 cursor-pointer border-none bg-transparent"
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
      onRowClick={(row) => onSelectEntry(row)}
      selectedRowKey={selectedEntryId}
      emptyMessage="No Port Forwards match the search filters."
    />
  );
};
