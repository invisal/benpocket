import type React from 'react';
import { useState, useRef, useEffect } from 'react';
import { ChevronDown, ChevronUp, X, Search } from 'lucide-react';
import { cn } from 'cnfast';

interface TerminalSearchBarProps {
  onSearch: (query: string, direction: 'next' | 'prev') => void;
  onClear: () => void;
  onClose: () => void;
}

/**
 * Slim find bar rendered above the terminal viewport. Enter / Shift+Enter step
 * through matches; Escape closes. Wired to xterm's SearchAddon via callbacks.
 */
export const TerminalSearchBar: React.FC<TerminalSearchBarProps> = ({
  onSearch,
  onClear,
  onClose
}) => {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (query) {
      onSearch(query, 'next');
    } else {
      onClear();
    }
    // Only re-run when the query text changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onSearch(query, e.shiftKey ? 'prev' : 'next');
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClear();
      onClose();
    }
  };

  return (
    <div className="h-7 shrink-0 flex items-center gap-2 px-3 border-b border-border-dark/50 bg-surface-2/40">
      <div className="flex items-center gap-1 bg-surface-2 border border-border-dark/60 rounded px-2 py-0.5 w-64">
        <Search className="size-3 text-muted-foreground" />
        <input
          ref={inputRef}
          type="text"
          placeholder="Find in Terminal..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          className="bg-transparent border-none text-[11px] text-foreground focus:outline-none w-full font-sans"
        />
      </div>
      <button
        onClick={() => onSearch(query, 'prev')}
        title="Previous match (Shift+Enter)"
        className={cn(
          'text-muted-foreground hover:text-foreground border-none bg-transparent cursor-pointer p-0.5'
        )}
      >
        <ChevronUp className="size-3" />
      </button>
      <button
        onClick={() => onSearch(query, 'next')}
        title="Next match (Enter)"
        className={cn(
          'text-muted-foreground hover:text-foreground border-none bg-transparent cursor-pointer p-0.5'
        )}
      >
        <ChevronDown className="size-3" />
      </button>
      <button
        onClick={() => {
          onClear();
          onClose();
        }}
        title="Close (Esc)"
        className="text-muted-foreground hover:text-foreground border-none bg-transparent cursor-pointer p-0.5 ml-auto"
      >
        <X className="size-3" />
      </button>
    </div>
  );
};
