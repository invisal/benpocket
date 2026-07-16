import type React from 'react';
import { ShieldCheck, AlertTriangle, Info } from 'lucide-react';
import { KubeTable, type Column } from '../../kubeTable';

interface EventResource {
  metadata?: {
    name?: string;
    namespace?: string;
    creationTimestamp?: string;
  };
  involvedObject?: {
    kind?: string;
    name?: string;
    namespace?: string;
  };
  source?: {
    component?: string;
  };
  reason?: string;
  message?: string;
  type?: string;
  lastTimestamp?: string;
  firstTimestamp?: string;
  count?: number;
}

interface WarningsFeedProps {
  events: EventResource[];
  namespace: string;
}

function formatEventAge(timestamp: string | undefined): string {
  if (!timestamp) return '-';
  const created = new Date(timestamp).getTime();
  const diff = Date.now() - created;
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (mins > 0) return `${mins}m ago`;
  return 'just now';
}

export const WarningsFeed: React.FC<WarningsFeedProps> = ({ events, namespace }) => {
  // Filter and limit to warning events
  const warningEvents = events
    .filter((e) => {
      // 1. Namespace filter matching kubectl behavior
      if (
        namespace &&
        namespace !== 'All Namespaces' &&
        e.involvedObject?.namespace !== namespace
      ) {
        return false;
      }
      // 2. Only show Warning type events, matching Lens IDE Warnings list
      return e.type?.toLowerCase() === 'warning';
    })
    // 3. Sort by timestamp descending (newest first)
    .sort((a, b) => {
      const timeA = new Date(a.lastTimestamp || a.metadata?.creationTimestamp || 0).getTime();
      const timeB = new Date(b.lastTimestamp || b.metadata?.creationTimestamp || 0).getTime();
      return timeB - timeA;
    });

  const columns: Column<EventResource>[] = [
    {
      key: 'type',
      header: 'Type',
      render: (evt) =>
        evt.type === 'Warning' ? (
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
      render: (evt) => (
        <span
          className="font-mono text-[11px] text-zinc-400 truncate"
          title={evt.source?.component}
        >
          {evt.source?.component || '-'}
        </span>
      ),
      initialWidth: 160
    },
    {
      key: 'namespace',
      header: 'Namespace',
      render: (evt) => (
        <span className="font-mono text-[11px] text-accent">
          {evt.involvedObject?.namespace || evt.metadata?.namespace || '-'}
        </span>
      ),
      initialWidth: 110
    },
    {
      key: 'involvedObject',
      header: 'Involved Object',
      render: (evt) => (
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[9px] px-1 py-0.5 rounded bg-surface-4 text-zinc-500 border border-border-dark/40 shrink-0 font-mono uppercase">
            {evt.involvedObject?.kind || '-'}
          </span>
          <span
            className="font-mono text-[11px] text-accent hover:underline cursor-pointer truncate"
            title={evt.involvedObject?.name}
          >
            {evt.involvedObject?.name || '-'}
          </span>
        </div>
      ),
      initialWidth: 220
    },
    {
      key: 'message',
      header: 'Message',
      render: (evt) => (
        <span className="text-[11px] text-zinc-350 truncate block" title={evt.message}>
          {evt.message}
        </span>
      ),
      className: 'max-w-[360px]',
      initialWidth: 360
    },
    {
      key: 'count',
      header: 'Count',
      render: (evt) => (
        <span className="font-mono text-[11px] text-zinc-500">{evt.count ?? 1}</span>
      ),
      initialWidth: 60,
      resizable: false
    },
    {
      key: 'age',
      header: 'Age',
      render: (evt) => (
        <span className="font-mono text-[11px] text-zinc-650">
          {formatEventAge(evt.firstTimestamp || evt.metadata?.creationTimestamp)}
        </span>
      ),
      initialWidth: 80,
      resizable: false
    },
    {
      key: 'lastSeen',
      header: 'Last Seen',
      render: (evt) => (
        <span className="font-mono text-[11px] text-zinc-555">
          {formatEventAge(evt.lastTimestamp || evt.metadata?.creationTimestamp)}
        </span>
      ),
      initialWidth: 80,
      resizable: false
    }
  ];

  return (
    <div className="flex-1 flex flex-col gap-2 select-none min-w-0 w-full relative min-h-0">
      <div className="px-4">
        <span className="text-xs font-bold text-text-base uppercase tracking-wider font-sans pb-1.5 border-b border-border/40 truncate shrink-0 block">
          Warning Events Log
        </span>
      </div>

      <div className="flex-1 min-h-0 flex flex-col mt-2">
        <KubeTable
          columns={columns}
          data={warningEvents}
          getRowKey={(evt) => evt.metadata?.name || Math.random().toString()}
          className="flex-1 overflow-x-auto"
          hideHeaderWhenEmpty
          emptyState={
            <div className="w-full flex flex-col items-center justify-center text-zinc-550 gap-2 py-8 select-none">
              <ShieldCheck className="size-8 text-emerald-500/40" />
              <span className="text-[10px] italic">
                No warnings active in cluster. Perfect health!
              </span>
            </div>
          }
        />
      </div>
    </div>
  );
};
