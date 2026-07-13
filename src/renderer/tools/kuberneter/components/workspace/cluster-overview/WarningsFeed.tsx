import type React from 'react';
import { ShieldCheck } from 'lucide-react';
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
  // Filter and limit to top 5 warning events to prevent infinite height expansion
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
    })
    .slice(0, 5);

  const columns: Column<EventResource>[] = [
    {
      key: 'reason',
      header: 'Reason',
      render: (evt) => (
        <span className="font-mono text-[11px] font-semibold text-rose-400 whitespace-nowrap">
          {evt.reason || 'Warning'}
        </span>
      )
    },
    {
      key: 'message',
      header: 'Message',
      render: (evt) => (
        <p
          className="text-zinc-400 font-sans text-[11px] truncate max-w-[400px]"
          title={evt.message}
        >
          {evt.message}
        </p>
      )
    },
    {
      key: 'object',
      header: 'Object',
      render: (evt) => (
        <span
          className="font-mono text-zinc-300 truncate max-w-[200px]"
          title={evt.involvedObject?.name}
        >
          {evt.involvedObject?.name || 'unknown'}
        </span>
      )
    },
    {
      key: 'type',
      header: 'Type',
      render: (evt) => (
        <span className="text-zinc-450 font-sans whitespace-nowrap">
          {evt.involvedObject?.kind || 'Resource'}
        </span>
      )
    },
    {
      key: 'count',
      header: 'Count',
      align: 'center',
      render: (evt) => <span className="font-mono text-zinc-400 text-[11px]">{evt.count || 1}</span>
    },
    {
      key: 'age',
      header: 'Age',
      render: (evt) => (
        <span className="font-mono text-zinc-500 shrink-0 whitespace-nowrap">
          {formatEventAge(evt.firstTimestamp || evt.metadata?.creationTimestamp)}
        </span>
      )
    },
    {
      key: 'lastSeen',
      header: 'Last Seen',
      render: (evt) => (
        <span className="font-mono text-zinc-500 shrink-0 whitespace-nowrap">
          {formatEventAge(evt.lastTimestamp || evt.metadata?.creationTimestamp)}
        </span>
      )
    }
  ];

  return (
    <div className="flex flex-col gap-2 select-none min-w-0 w-full relative">
      <div className="px-4">
        <span className="text-xs font-bold text-text-base uppercase tracking-wider font-sans pb-1.5 border-b border-border/40 truncate shrink-0 block">
          Warning Events Log
        </span>
      </div>

      <div className="mt-2">
        <KubeTable
          columns={columns}
          data={warningEvents}
          getRowKey={(evt) => evt.metadata?.name || Math.random().toString()}
          className="mt-2 overflow-visible flex-initial"
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
