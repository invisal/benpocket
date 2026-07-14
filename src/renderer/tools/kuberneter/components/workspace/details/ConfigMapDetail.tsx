import type React from 'react';
import { useState } from 'react';
import { type ConfigMapData } from '../../../types/ConfigMapData';
import { ChevronRight, ChevronDown, Copy, Check, FileText, Binary } from 'lucide-react';

interface ConfigMapDetailProps {
  payload: ConfigMapData;
  isTab?: boolean;
}

export const ConfigMapDetail: React.FC<ConfigMapDetailProps> = ({ payload, isTab = false }) => {
  const [expandedKeys, setExpandedKeys] = useState<Record<string, boolean>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!payload) {
    return <div className="p-4 text-xs text-zinc-500">No config map details available.</div>;
  }

  const toggleKey = (key: string) => {
    setExpandedKeys((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleCopy = (key: string, value: string) => {
    navigator.clipboard.writeText(value);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const labels = payload.labels ? Object.entries(payload.labels) : [];
  const annotations = payload.annotations ? Object.entries(payload.annotations) : [];
  const dataEntries = payload.data ? Object.entries(payload.data) : [];
  const binaryEntries = payload.binaryData ? Object.entries(payload.binaryData) : [];

  return (
    <div className={`flex flex-col gap-4 ${isTab ? 'p-6 h-full overflow-y-auto' : 'flex-1'}`}>
      {/* Basic Metadata */}
      <div className="flex flex-col gap-2.5 text-xs text-zinc-350">
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] text-zinc-555 uppercase">Resource Name</span>
          <span className="font-mono text-zinc-200 break-all">{payload.name}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] text-zinc-555 uppercase">Namespace</span>
          <span className="font-mono text-zinc-300">{payload.ns}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] text-zinc-555 uppercase">Created / Age</span>
          <span className="font-mono text-zinc-300">{payload.age}</span>
        </div>
      </div>

      {/* Labels */}
      {labels.length > 0 && (
        <div className="flex flex-col gap-1.5 border-t border-border-dark/60 pt-3">
          <span className="text-[10px] font-bold text-zinc-455 uppercase">Labels</span>
          <div className="flex flex-wrap gap-1">
            {labels.map(([k, v]) => (
              <span
                key={k}
                className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-surface-2 border border-border text-zinc-300 break-all"
              >
                {k}: {v}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Annotations */}
      {annotations.length > 0 && (
        <div className="flex flex-col gap-1.5 border-t border-border-dark/60 pt-3">
          <span className="text-[10px] font-bold text-zinc-455 uppercase">Annotations</span>
          <div className="flex flex-col gap-1 max-h-32 overflow-y-auto pr-1">
            {annotations.map(([k, v]) => (
              <div
                key={k}
                className="text-[10px] font-mono bg-surface-2/40 border border-border/40 rounded p-1 text-zinc-400 break-all"
              >
                <div className="text-zinc-300 font-semibold">{k}</div>
                <div className="mt-0.5 whitespace-pre-wrap select-text">{v}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Config Map Data Keys */}
      <div className="flex flex-col gap-2.5 border-t border-border-dark/60 pt-3">
        <span className="text-[10px] font-bold text-zinc-455 uppercase">
          Data ({dataEntries.length} keys)
        </span>
        {dataEntries.length === 0 ? (
          <span className="text-xs text-zinc-500 italic">No data entries.</span>
        ) : (
          <div className="flex flex-col gap-2">
            {dataEntries.map(([key, val]) => {
              const isExpanded = !!expandedKeys[key];
              const isCopied = copiedKey === key;
              return (
                <div
                  key={key}
                  className="border border-border rounded-lg bg-surface-2 overflow-hidden"
                >
                  <div
                    onClick={() => toggleKey(key)}
                    className="flex items-center justify-between p-2 cursor-pointer hover:bg-surface-3 transition-colors select-none"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      {isExpanded ? (
                        <ChevronDown className="size-3.5 text-zinc-400 shrink-0" />
                      ) : (
                        <ChevronRight className="size-3.5 text-zinc-400 shrink-0" />
                      )}
                      <FileText className="size-3.5 text-accent shrink-0" />
                      <span className="font-mono text-xs text-zinc-200 truncate" title={key}>
                        {key}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] text-zinc-500 font-mono">
                        {val ? `${val.length} bytes` : '0 bytes'}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopy(key, val);
                        }}
                        className="p-1 rounded hover:bg-surface-4 text-zinc-500 hover:text-zinc-200 transition-colors border-none bg-transparent cursor-pointer"
                        title="Copy content"
                      >
                        {isCopied ? (
                          <Check className="size-3 text-emerald-500" />
                        ) : (
                          <Copy className="size-3" />
                        )}
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="p-2 border-t border-border bg-editor-bg">
                      <pre className="p-2 font-mono text-[10px] overflow-auto text-zinc-350 select-text max-h-60 whitespace-pre-wrap break-all bg-black/20 rounded border border-border-dark/30">
                        {val}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Binary Data Section */}
      {binaryEntries.length > 0 && (
        <div className="flex flex-col gap-2.5 border-t border-border-dark/60 pt-3">
          <span className="text-[10px] font-bold text-zinc-455 uppercase">
            Binary Data ({binaryEntries.length} keys)
          </span>
          <div className="flex flex-col gap-2">
            {binaryEntries.map(([key, val]) => {
              const isExpanded = !!expandedKeys[`bin-${key}`];
              const isCopied = copiedKey === `bin-${key}`;
              return (
                <div
                  key={key}
                  className="border border-border rounded-lg bg-surface-2 overflow-hidden"
                >
                  <div
                    onClick={() => toggleKey(`bin-${key}`)}
                    className="flex items-center justify-between p-2 cursor-pointer hover:bg-surface-3 transition-colors select-none"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      {isExpanded ? (
                        <ChevronDown className="size-3.5 text-zinc-400 shrink-0" />
                      ) : (
                        <ChevronRight className="size-3.5 text-zinc-400 shrink-0" />
                      )}
                      <Binary className="size-3.5 text-amber-500 shrink-0" />
                      <span className="font-mono text-xs text-zinc-200 truncate" title={key}>
                        {key}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] text-zinc-500 font-mono">
                        {val ? `${val.length} bytes` : '0 bytes'}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopy(`bin-${key}`, val);
                        }}
                        className="p-1 rounded hover:bg-surface-4 text-zinc-500 hover:text-zinc-200 transition-colors border-none bg-transparent cursor-pointer"
                        title="Copy Base64 content"
                      >
                        {isCopied ? (
                          <Check className="size-3 text-emerald-500" />
                        ) : (
                          <Copy className="size-3" />
                        )}
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="p-2 border-t border-border bg-editor-bg">
                      <div className="text-[9px] text-zinc-500 uppercase tracking-wider mb-1">
                        Base64 Encoded Value
                      </div>
                      <pre className="p-2 font-mono text-[10px] overflow-auto text-zinc-350 select-text max-h-32 whitespace-pre-wrap break-all bg-black/20 rounded border border-border-dark/30">
                        {val}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
