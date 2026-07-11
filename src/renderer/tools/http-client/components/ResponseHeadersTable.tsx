import React, { useMemo, useState } from 'react';
import { Check, Copy } from 'lucide-react';

const COPY_FEEDBACK_MS = 1500;

interface ResponseHeadersTableProps {
  headers: Record<string, string>;
}

/** Read-only response headers table, styled after KeyValueEditor's grid but without the editable inputs. */
export const ResponseHeadersTable: React.FC<ResponseHeadersTableProps> = ({ headers }) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  const entries = useMemo(
    () => Object.entries(headers).sort(([a], [b]) => a.localeCompare(b)),
    [headers]
  );

  const copy = async (text: string, key: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), COPY_FEEDBACK_MS);
    } catch {
      // Clipboard API unavailable/denied - nothing else to fall back to.
    }
  };

  const copyAll = async (): Promise<void> => {
    const text = entries.map(([key, value]) => `${key}: ${value}`).join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), COPY_FEEDBACK_MS);
    } catch {
      // Clipboard API unavailable/denied - nothing else to fall back to.
    }
  };

  if (entries.length === 0) {
    return <div className="text-xs text-zinc-600 select-none">No headers.</div>;
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between px-1">
        <div className="grid grid-cols-[1fr_1fr] gap-2 flex-1 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
          <span>Key</span>
          <span>Value</span>
        </div>
        <button
          onClick={copyAll}
          title="Copy all headers"
          className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-500 hover:text-white cursor-pointer transition-colors shrink-0"
        >
          {copiedAll ? <Check size={10} className="text-emerald-400" /> : <Copy size={10} />}
          Copy all
        </button>
      </div>
      {entries.map(([key, value]) => (
        <div
          key={key}
          className="grid grid-cols-[1fr_1fr_20px] gap-2 items-start px-1 py-1 rounded border border-transparent hover:border-border-dark"
        >
          <span className="text-accent font-mono text-xs break-all select-text">{key}</span>
          <span className="text-zinc-400 font-mono text-xs break-all select-text">{value}</span>
          <button
            onClick={() => copy(value, key)}
            title="Copy value"
            className="p-0.5 text-zinc-600 hover:text-white cursor-pointer transition-colors justify-self-center"
          >
            {copiedKey === key ? (
              <Check size={11} className="text-emerald-400" />
            ) : (
              <Copy size={11} />
            )}
          </button>
        </div>
      ))}
    </div>
  );
};
