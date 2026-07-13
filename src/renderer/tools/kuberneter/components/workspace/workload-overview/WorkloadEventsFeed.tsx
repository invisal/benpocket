import React, { useMemo, useState } from 'react';
import { KubeTable, Column } from '../../kubeTable';
import { KubeSearchbox } from '../../KubeSearchbox';
import { AlertTriangle, Download, Info } from 'lucide-react';
import { EventData } from '../../../types/EventData';

interface WorkloadEventsFeedProps {
  eventsData: EventData[];
  kuberneterSelectedNamespace: string;
}

export const WorkloadEventsFeed: React.FC<WorkloadEventsFeedProps> = ({
  eventsData,
  kuberneterSelectedNamespace
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [warningsOnly, setWarningsOnly] = useState(false);

  const filteredData = useMemo(() => {
    return eventsData.filter((ev) => {
      if (kuberneterSelectedNamespace !== 'All Namespaces' && ev.ns !== kuberneterSelectedNamespace)
        return false;
      if (warningsOnly && ev.type !== 'Warning') return false;
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        ev.message.toLowerCase().includes(q) ||
        ev.source.toLowerCase().includes(q) ||
        ev.ns.toLowerCase().includes(q) ||
        ev.involvedObject.toLowerCase().includes(q) ||
        ev.involvedKind.toLowerCase().includes(q)
      );
    });
  }, [eventsData, kuberneterSelectedNamespace, searchQuery, warningsOnly]);

  const warningCount = useMemo(
    () => eventsData.filter((e) => e.type === 'Warning').length,
    [eventsData]
  );

  const handleDownloadCsv = () => {
    if (filteredData.length === 0) return;
    const headers = [
      'Type',
      'Source',
      'Namespace',
      'Involved Object',
      'Kind',
      'Message',
      'Count',
      'Age',
      'Last Seen'
    ];
    const rows = filteredData.map((e) =>
      [
        e.type,
        `"${e.source}"`,
        e.ns,
        `"${e.involvedObject}"`,
        e.involvedKind,
        `"${e.message.replace(/"/g, '""')}"`,
        e.count,
        e.age,
        e.lastSeen
      ].join(',')
    );
    const blob = new Blob([[headers.join(','), ...rows].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `events-export-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const columns = useMemo<Column<EventData>[]>(
    () => [
      {
        key: 'type',
        header: 'Type',
        render: (row) =>
          row.type === 'Warning' ? (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/20">
              <AlertTriangle className="size-2.5" />
              Warning
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-zinc-800/60 text-zinc-500 border border-border-dark/40">
              <Info className="size-2.5" />
              Normal
            </span>
          ),
        initialWidth: 96,
        resizable: false
      },
      {
        key: 'source',
        header: 'Source',
        render: (row) => (
          <span className="font-mono text-[11px] text-zinc-400 truncate" title={row.source}>
            {row.source}
          </span>
        ),
        initialWidth: 160
      },
      {
        key: 'namespace',
        header: 'Namespace',
        render: (row) => <span className="font-mono text-[11px] text-accent">{row.ns || '-'}</span>,
        initialWidth: 110
      },
      {
        key: 'involvedObject',
        header: 'Involved Object',
        render: (row) => (
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[9px] px-1 py-0.5 rounded bg-surface-4 text-zinc-500 border border-border-dark/40 shrink-0 font-mono uppercase">
              {row.involvedKind}
            </span>
            <span
              className="font-mono text-[11px] text-accent hover:underline cursor-pointer truncate"
              title={row.involvedObject}
            >
              {row.involvedObject}
            </span>
          </div>
        ),
        initialWidth: 220
      },
      {
        key: 'message',
        header: 'Message',
        render: (row) => (
          <span className="text-[11px] text-zinc-350 truncate block" title={row.message}>
            {row.message}
          </span>
        ),
        className: 'max-w-[360px]',
        initialWidth: 360
      },
      {
        key: 'count',
        header: 'Count',
        render: (row) => <span className="font-mono text-[11px] text-zinc-500">{row.count}</span>,
        initialWidth: 60,
        resizable: false
      },
      {
        key: 'age',
        header: 'Age',
        render: (row) => <span className="font-mono text-[11px] text-zinc-600">{row.age}</span>,
        initialWidth: 80,
        resizable: false
      },
      {
        key: 'lastSeen',
        header: 'Last Seen',
        render: (row) => (
          <span className="font-mono text-[11px] text-zinc-555">{row.lastSeen}</span>
        ),
        initialWidth: 80,
        resizable: false
      }
    ],
    []
  );

  return (
    <div className="flex flex-col gap-3 flex-1 min-h-0">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2.5">
          <KubeSearchbox
            value={searchQuery}
            placeholder="Search events..."
            onChange={setSearchQuery}
            className="w-56"
          />
          {/* Warnings only toggle */}
          <button
            onClick={() => setWarningsOnly((v) => !v)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[11px] font-medium border transition-all cursor-pointer ${
              warningsOnly
                ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                : 'bg-surface-2 border-border-dark/60 text-zinc-500 hover:text-zinc-300 hover:border-border-dark'
            }`}
          >
            <AlertTriangle className="size-3" />
            Warnings
            {warningCount > 0 && <span className="ml-0.5 text-amber-400/80">({warningCount})</span>}
          </button>
        </div>

        <div
          className="flex items-center gap-1.5 text-zinc-555 hover:text-zinc-350 transition-colors cursor-pointer select-none"
          onClick={handleDownloadCsv}
        >
          <Download className="size-3.5" />
          <span className="text-[11px] font-medium">{filteredData.length} Events</span>
        </div>
      </div>

      {/* Table */}
      <KubeTable
        columns={columns}
        data={filteredData}
        getRowKey={(row) => row.id}
        variant="modern"
        className="flex-1"
        emptyMessage={
          warningsOnly
            ? 'No warning events found.'
            : searchQuery
              ? 'No events match the search filters.'
              : 'No events found.'
        }
      />
    </div>
  );
};
