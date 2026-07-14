import type React from 'react';
import { useState } from 'react';
import { type SecretData } from '../../../types/SecretData';
import { ChevronRight, ChevronDown, Copy, Check, FileKey, Eye, EyeOff } from 'lucide-react';

interface SecretDetailProps {
  payload: SecretData;
  isTab?: boolean;
}

export const SecretDetail: React.FC<SecretDetailProps> = ({ payload, isTab = false }) => {
  const [expandedKeys, setExpandedKeys] = useState<Record<string, boolean>>({});
  const [revealedKeys, setRevealedKeys] = useState<Record<string, boolean>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!payload) {
    return <div className="p-4 text-xs text-zinc-500">No secret details available.</div>;
  }

  const toggleKey = (key: string) => {
    setExpandedKeys((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleReveal = (key: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setRevealedKeys((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const decodeValue = (base64Val: string) => {
    try {
      const decoded = window.atob(base64Val);
      // Heuristic to check if text is printable/UTF-8
      const isPrintable = /^[\t\n\r\x20-\x7E]*$/.test(decoded);
      return isPrintable ? decoded : `[Binary Content / Non-printable] Base64: ${base64Val}`;
    } catch {
      return base64Val;
    }
  };

  const handleCopy = (key: string, base64Val: string, decode: boolean) => {
    const textToCopy = decode ? decodeValue(base64Val) : base64Val;
    navigator.clipboard.writeText(textToCopy);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const labels = payload.labels ? Object.entries(payload.labels) : [];
  const annotations = payload.annotations ? Object.entries(payload.annotations) : [];
  const dataEntries = payload.data ? Object.entries(payload.data) : [];

  return (
    <div className={`flex flex-col gap-4 ${isTab ? 'p-6 h-full overflow-y-auto' : 'flex-1'}`}>
      {/* Basic Metadata */}
      <div className="flex flex-col gap-2.5 text-xs text-zinc-355">
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] text-zinc-555 uppercase">Resource Name</span>
          <span className="font-mono text-zinc-200 break-all">{payload.name}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] text-zinc-555 uppercase">Namespace</span>
          <span className="font-mono text-zinc-300">{payload.ns}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] text-zinc-555 uppercase">Secret Type</span>
          <span className="font-mono text-zinc-300">{payload.type}</span>
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

      {/* Secret Data Keys */}
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
              const isRevealed = !!revealedKeys[key];
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
                      <FileKey className="size-3.5 text-amber-500 shrink-0" />
                      <span className="font-mono text-xs text-zinc-200 truncate" title={key}>
                        {key}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={(e) => toggleReveal(key, e)}
                        className="p-1 rounded hover:bg-surface-4 text-zinc-500 hover:text-zinc-200 transition-colors border-none bg-transparent cursor-pointer"
                        title={isRevealed ? 'Hide value' : 'Reveal value'}
                      >
                        {isRevealed ? (
                          <EyeOff className="size-3.5" />
                        ) : (
                          <Eye className="size-3.5" />
                        )}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopy(key, val, true);
                        }}
                        className="p-1 rounded hover:bg-surface-4 text-zinc-500 hover:text-zinc-200 transition-colors border-none bg-transparent cursor-pointer"
                        title="Copy decoded plain-text"
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
                        {isRevealed ? decodeValue(val) : '••••••••••••••••'}
                      </pre>
                    </div>
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
