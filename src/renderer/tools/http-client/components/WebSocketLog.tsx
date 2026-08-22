import type React from 'react';
import { useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  Info,
  Search,
  Trash2
} from 'lucide-react';
import { Menu } from '@renderer/components/ui/Menu';
import { Input } from '@renderer/components/ui/Input';
import type { WsLogDirection, WsLogEntry, WsStatus } from '../hooks/useWebSocket';

function formatTime(timestamp: number): string {
  const d = new Date(timestamp);
  const pad = (n: number, len = 2): string => n.toString().padStart(len, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
}

function tryPrettyPrint(message: string): string {
  try {
    return JSON.stringify(JSON.parse(message), null, 2);
  } catch {
    return message;
  }
}

const STATUS_LABEL: Record<WsStatus, string> = {
  CONNECTED: 'Connected',
  CONNECTING: 'Connecting...',
  DISCONNECTED: 'Disconnected',
  ERROR: 'Error'
};

const STATUS_CLASS: Record<WsStatus, string> = {
  CONNECTED: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25',
  CONNECTING: 'bg-amber-500/10 text-amber-400 border-amber-500/25',
  DISCONNECTED: 'bg-red-500/10 text-red-400 border-red-500/25',
  ERROR: 'bg-red-500/10 text-red-400 border-red-500/25'
};

type LogFilter = 'all' | WsLogDirection;

const FILTER_LABEL: Record<LogFilter, string> = {
  all: 'All Messages',
  OUT: 'Sent',
  IN: 'Received',
  SYSTEM: 'System'
};

function directionIcon(entry: WsLogEntry): React.ReactNode {
  if (entry.direction === 'IN')
    return <ArrowDownLeft size={13} className="text-sky-400 shrink-0" />;
  if (entry.direction === 'OUT')
    return <ArrowUpRight size={13} className="text-amber-500 shrink-0" />;
  switch (entry.systemKind) {
    case 'connected':
      return <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />;
    case 'error':
      return <AlertCircle size={13} className="text-red-400 shrink-0" />;
    default:
      return <Info size={13} className="text-muted-foreground shrink-0" />;
  }
}

interface WebSocketLogProps {
  log: WsLogEntry[];
  status: WsStatus;
  onClear: () => void;
}

export const WebSocketLog: React.FC<WebSocketLogProps> = ({ log, status, onClear }) => {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<LogFilter>('all');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpanded = (id: string): void => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Newest first - the most recent activity is always the first thing visible
  // without needing to scroll.
  const visibleLog = useMemo(() => {
    const byDirection = filter === 'all' ? log : log.filter((e) => e.direction === filter);
    const query = search.trim().toLowerCase();
    const bySearch = query
      ? byDirection.filter((e) => e.message.toLowerCase().includes(query))
      : byDirection;
    return [...bySearch].reverse();
  }, [log, filter, search]);

  return (
    <div className="h-full border-t border-border-light flex flex-col min-h-0">
      <div className="bg-surface-2 border-b border-border px-3 py-2 flex items-center justify-between text-sm shrink-0 select-none">
        <span className="font-medium uppercase tracking-wider text-[10px]">Response</span>
        <span
          className={`px-2 py-0.5 rounded text-[10px] font-bold border ${STATUS_CLASS[status]}`}
        >
          {STATUS_LABEL[status]}
        </span>
      </div>

      <div className="flex items-center gap-2 px-3 py-2 border-b border-border shrink-0">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-zinc-500 pointer-events-none" />
          <Input
            size="sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search"
            className="pl-8 bg-surface border-border-dark text-sm placeholder:text-zinc-600"
          />
        </div>

        <Menu.Root>
          <Menu.Trigger className="flex items-center gap-1 h-7 px-2 text-[11px] font-semibold text-zinc-400 hover:text-foreground border border-border-dark rounded cursor-pointer shrink-0">
            <span>{FILTER_LABEL[filter]}</span>
            <ChevronDown size={11} />
          </Menu.Trigger>
          <Menu.Content align="start">
            {(Object.keys(FILTER_LABEL) as LogFilter[]).map((f) => (
              <Menu.Item key={f} onClick={() => setFilter(f)}>
                {FILTER_LABEL[f]}
              </Menu.Item>
            ))}
          </Menu.Content>
        </Menu.Root>

        <button
          onClick={onClear}
          disabled={log.length === 0}
          title="Clear log"
          className="flex items-center gap-1 h-7 px-2 text-[11px] font-semibold text-zinc-400 hover:text-foreground disabled:opacity-30 disabled:cursor-default cursor-pointer transition-colors shrink-0"
        >
          <Trash2 size={12} />
          <span>Clear Messages</span>
        </button>
      </div>

      <div className="flex-1 overflow-auto select-text">
        {log.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-1.5 text-zinc-650 text-sm">
            <Info size={20} />
            <span>No activity yet. Connect to start streaming messages.</span>
          </div>
        ) : visibleLog.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-1.5 text-zinc-650 text-sm">
            <Search size={20} />
            <span>No messages match your search.</span>
          </div>
        ) : (
          <div className="flex flex-col">
            {visibleLog.map((entry) => {
              const pretty = tryPrettyPrint(entry.message);
              const expanded = expandedIds.has(entry.id);
              return (
                <div key={entry.id} className="border-b border-border-light">
                  <button
                    onClick={() => toggleExpanded(entry.id)}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-surface-2 cursor-pointer transition-colors text-left"
                  >
                    {directionIcon(entry)}
                    <span className="flex-1 min-w-0 truncate font-mono text-zinc-200">
                      {entry.message}
                    </span>
                    <span className="shrink-0 text-[10px] text-zinc-600 font-mono">
                      {formatTime(entry.timestamp)}
                    </span>
                    <ChevronDown
                      size={12}
                      className={`shrink-0 text-zinc-600 transition-transform ${expanded ? 'rotate-180' : ''}`}
                    />
                  </button>
                  {expanded && (
                    <pre className="px-3 pb-2 pl-8 font-mono text-sm whitespace-pre-wrap break-all text-zinc-300">
                      {pretty}
                    </pre>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
