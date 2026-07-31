import type React from 'react';
import { useState, useCallback } from 'react';
import '@xterm/xterm/css/xterm.css';
import { cn } from 'cnfast';
import { useKuberneterTerminal } from './useKuberneterTerminal';
import { TerminalSearchBar } from './TerminalSearchBar';

interface KuberneterTerminalProps {
  /** Stable session id; the PTY lives for the life of this id. */
  sessionId: string;
  /** Active context name (shown in the subheader, injected into the shell). */
  contextName: string;
  /** Kubeconfig path passed to the PTY ('default'/undefined => ambient). */
  kubeconfigPath?: string;
  /** Whether this terminal's tab is currently visible. */
  isActive: boolean;
}

/**
 * A full xterm.js terminal backed by a main-process PTY, styled to match the
 * Kuberneter panel. Interactive TTY programs (kubectl exec -it, k9s, vim) work
 * because the backend is a real pseudo-terminal.
 */
export const KuberneterTerminal: React.FC<KuberneterTerminalProps> = ({
  sessionId,
  contextName,
  kubeconfigPath,
  isActive
}) => {
  const [searchOpen, setSearchOpen] = useState(false);
  const { containerRef, hasExited, search, clearSearch, focus } = useKuberneterTerminal({
    sessionId,
    contextName,
    kubeconfigPath,
    isActive
  });

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') {
      e.preventDefault();
      setSearchOpen(true);
    }
  }, []);

  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    focus();
  }, [focus]);

  return (
    <div
      className="flex-1 flex flex-col min-h-0"
      onKeyDown={handleKeyDown}
      // Clicking anywhere in the panel should return focus to the shell.
      onMouseDown={() => {
        if (!searchOpen) focus();
      }}
    >
      {searchOpen && (
        <TerminalSearchBar onSearch={search} onClear={clearSearch} onClose={closeSearch} />
      )}

      {/* Cluster context subheader */}
      <div className="px-3 py-1.5 border-b border-border-dark/40 bg-surface-2/20 text-muted-foreground text-[11px] font-sans shrink-0">
        Kubernetes cluster{' '}
        <span className="text-accent font-mono">{contextName || 'no context'}</span> in context.
        {hasExited && <span className="ml-2 text-danger">session ended</span>}
      </div>

      {/* xterm viewport */}
      <div
        className={cn('flex-1 min-h-0 overflow-hidden px-2 pt-1 bg-surface')}
        // xterm measures this element; it must fill available space.
      >
        <div ref={containerRef} className="w-full h-full" />
      </div>
    </div>
  );
};
