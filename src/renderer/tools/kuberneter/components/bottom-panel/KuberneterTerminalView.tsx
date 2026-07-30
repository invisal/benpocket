import type React from 'react';
import { useState } from 'react';
import { ChevronDown, ChevronUp, CornerDownLeft } from 'lucide-react';

interface KuberneterTerminalViewProps {
  activeCluster: string;
  history: string[];
  onSubmitCommand: (cmd: string) => void;
}

export const KuberneterTerminalView: React.FC<KuberneterTerminalViewProps> = ({
  activeCluster,
  history,
  onSubmitCommand
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [inputVal, setInputVal] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputVal.trim()) return;
    onSubmitCommand(inputVal);
    setInputVal('');
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 font-mono text-[11px] select-text">
      {/* Search Bar Subheader */}
      <div className="h-7 shrink-0 flex items-center justify-between px-3 border-b border-border-dark/50 bg-surface-2/40 text-xs">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-surface-2 border border-border-dark/60 rounded px-2 py-0.5 w-64">
            <span className="text-[10px] font-sans font-bold text-zinc-500 select-none cursor-pointer hover:text-white">
              Aa
            </span>
            <span className="text-[10px] font-sans font-bold text-zinc-500 select-none cursor-pointer hover:text-white">
              .*
            </span>
            <input
              type="text"
              placeholder="Search in Terminal..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent border-none text-[11px] text-zinc-200 focus:outline-none w-full font-sans"
            />
          </div>
          <span className="text-[10px] text-zinc-500 font-sans">0 / 0</span>
          <button className="text-zinc-500 hover:text-zinc-200 border-none bg-transparent cursor-pointer p-0.5">
            <ChevronDown className="size-3" />
          </button>
          <button className="text-zinc-500 hover:text-zinc-200 border-none bg-transparent cursor-pointer p-0.5">
            <ChevronUp className="size-3" />
          </button>
        </div>
      </div>

      {/* Sub-header cluster link info */}
      <div className="px-3 py-1.5 border-b border-border-dark/40 bg-surface-2/20 text-zinc-400 text-[11px] font-sans">
        Kubernetes cluster{' '}
        <span className="text-blue-400 underline font-mono cursor-pointer">{activeCluster}</span> in
        context.
      </div>

      {/* Terminal Logs & Interactive Prompt */}
      <div className="flex-1 p-3 overflow-y-auto flex flex-col gap-1 text-zinc-300">
        {history.map((line, idx) => (
          <div key={idx} className="whitespace-pre-wrap leading-relaxed">
            {line}
          </div>
        ))}

        {/* Input prompt line */}
        <form onSubmit={handleSubmit} className="flex items-center gap-1 mt-1">
          <span className="text-zinc-300 font-medium">keppere@MacBook-Air ~ % </span>
          <input
            type="text"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            autoFocus
            className="flex-1 bg-transparent border-none text-zinc-100 focus:outline-none text-[11px] font-mono"
          />
          <button type="submit" className="hidden">
            <CornerDownLeft className="size-3" />
          </button>
        </form>
      </div>
    </div>
  );
};
