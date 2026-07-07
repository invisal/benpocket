import React, { useEffect, useRef } from 'react';
import { ArrowDownLeft, ArrowUpRight, Info, Trash2 } from 'lucide-react';
import type { WsLogEntry } from '../hooks/useWebSocket';

function formatTime(timestamp: number): string {
  const d = new Date(timestamp);
  const pad = (n: number): string => n.toString().padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function tryPrettyPrint(message: string): string {
  try {
    return JSON.stringify(JSON.parse(message), null, 2);
  } catch {
    return message;
  }
}

interface WebSocketLogProps {
  log: WsLogEntry[];
  onClear: () => void;
}

export const WebSocketLog: React.FC<WebSocketLogProps> = ({ log, onClear }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [log.length]);

  return (
    <div className="flex-1 bg-sidebar-bg border border-border-dark rounded-lg overflow-hidden flex flex-col min-h-0">
      <div className="bg-editor-bg border-b border-border-dark px-3 py-2 flex items-center justify-between text-xs shrink-0 select-none">
        <span className="text-zinc-500 font-bold uppercase tracking-wider text-[10px]">Live Stream Log</span>
        <button
          onClick={onClear}
          disabled={log.length === 0}
          title="Clear log"
          className="p-1 text-zinc-555 hover:text-white disabled:opacity-30 disabled:cursor-default cursor-pointer transition-colors"
        >
          <Trash2 size={12} />
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-auto p-3 font-mono text-xs select-text">
        {log.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-1.5 text-zinc-650">
            <Info size={20} />
            <span>No activity yet. Connect to start streaming messages.</span>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {log.map((entry) => (
              <div key={entry.id} className="flex items-start gap-2 leading-relaxed">
                <span className="text-zinc-600 shrink-0">{formatTime(entry.timestamp)}</span>
                {entry.direction === 'IN' && (
                  <ArrowDownLeft size={12} className="text-sky-400 shrink-0 mt-0.5" />
                )}
                {entry.direction === 'OUT' && (
                  <ArrowUpRight size={12} className="text-emerald-400 shrink-0 mt-0.5" />
                )}
                {entry.direction === 'SYSTEM' && <Info size={12} className="text-amber-500 shrink-0 mt-0.5" />}
                <pre
                  className={`whitespace-pre-wrap break-all ${
                    entry.direction === 'IN'
                      ? 'text-sky-300'
                      : entry.direction === 'OUT'
                        ? 'text-emerald-300'
                        : 'text-zinc-500 italic'
                  }`}
                >
                  {entry.direction === 'SYSTEM' ? entry.message : tryPrettyPrint(entry.message)}
                </pre>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
