import { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { SearchAddon } from '@xterm/addon-search';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { buildXtermTheme } from './xtermTheme';

export interface UseKuberneterTerminalParams {
  /** Stable id; the PTY session persists for the life of this id. */
  sessionId: string;
  /** Active context name to inject into the shell environment. */
  contextName?: string;
  /** Kubeconfig path ('default' or undefined uses the ambient config). */
  kubeconfigPath?: string;
  /** When false the terminal is mounted but hidden; defer fit until shown. */
  isActive: boolean;
}

export interface UseKuberneterTerminalResult {
  containerRef: React.RefObject<HTMLDivElement | null>;
  hasExited: boolean;
  search: (query: string, direction: 'next' | 'prev') => void;
  clearSearch: () => void;
  focus: () => void;
}

/**
 * Wires an xterm.js instance to a main-process PTY over IPC. Mirrors VS Code's
 * integrated-terminal architecture: the renderer owns rendering + input, the
 * main process owns the real pseudo-terminal. The session is created once per
 * sessionId and torn down on unmount.
 */
export function useKuberneterTerminal({
  sessionId,
  contextName,
  kubeconfigPath,
  isActive
}: UseKuberneterTerminalParams): UseKuberneterTerminalResult {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const searchRef = useRef<SearchAddon | null>(null);
  const [hasExited, setHasExited] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 12,
      fontFamily:
        "'JetBrains Mono', 'SF Mono', 'Cascadia Code', Menlo, Monaco, 'Courier New', monospace",
      lineHeight: 1.2,
      scrollback: 10000,
      allowProposedApi: true,
      theme: buildXtermTheme()
    });

    const fit = new FitAddon();
    const search = new SearchAddon();
    term.loadAddon(fit);
    term.loadAddon(search);
    term.loadAddon(new WebLinksAddon());

    term.open(container);
    termRef.current = term;
    fitRef.current = fit;
    searchRef.current = search;

    // Focus straight away when mounted visible so the first keystroke lands in
    // the shell without needing a click. (Hidden tabs focus via the isActive
    // effect once they're shown.)
    if (isActive) term.focus();

    // Initial fit once the element has layout.
    let cols = 80;
    let rows = 24;
    try {
      fit.fit();
      cols = term.cols;
      rows = term.rows;
    } catch {
      // Container not laid out yet; PTY will get a resize once visible.
    }

    // Spawn the PTY, then stream both directions.
    let disposed = false;
    const offData = window.kuberneter.onTerminalData(sessionId, (data) => {
      term.write(data);
    });
    const offExit = window.kuberneter.onTerminalExit(sessionId, (code) => {
      if (disposed) return;
      term.writeln(`\r\n\x1b[90m[process exited with code ${code}]\x1b[0m`);
      setHasExited(true);
    });

    // Wire input BEFORE awaiting create so no early keystroke is dropped.
    const inputDisposable = term.onData((data) => {
      window.kuberneter.terminalInput(sessionId, data);
    });

    window.kuberneter
      .terminalCreate(sessionId, { contextName, kubeconfigPath, cols, rows })
      .then((res) => {
        if (disposed) return;
        if (res?.error) {
          // A swallowed spawn failure previously looked like a dead terminal
          // that "won't accept input" — surface it in the viewport instead.
          term.writeln(`\r\n\x1b[31m[failed to start shell: ${res.error}]\x1b[0m`);
          setHasExited(true);
        }
      })
      .catch((err: unknown) => {
        if (disposed) return;
        const message = err instanceof Error ? err.message : String(err);
        term.writeln(`\r\n\x1b[31m[failed to start shell: ${message}]\x1b[0m`);
        setHasExited(true);
      });

    const resizeDisposable = term.onResize(({ cols: c, rows: r }) => {
      window.kuberneter.terminalResize(sessionId, c, r);
    });

    // Keep the PTY sized to the container.
    const resizeObserver = new ResizeObserver(() => {
      if (!container.offsetParent) return; // hidden; skip
      try {
        fit.fit();
      } catch {
        // ignore transient layout errors
      }
    });
    resizeObserver.observe(container);

    return () => {
      disposed = true;
      offData();
      offExit();
      inputDisposable.dispose();
      resizeDisposable.dispose();
      resizeObserver.disconnect();
      void window.kuberneter.terminalDispose(sessionId);
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
      searchRef.current = null;
    };
    // Session identity is fixed for the component's life; context/config are
    // captured at spawn time. Re-running would orphan the PTY.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // When the tab becomes active, re-fit (it may have been hidden at mount) and
  // focus so typing goes straight to the shell.
  useEffect(() => {
    if (!isActive) return;
    const term = termRef.current;
    const fit = fitRef.current;
    if (!term || !fit) return;
    const raf = requestAnimationFrame(() => {
      try {
        fit.fit();
      } catch {
        // ignore
      }
      term.focus();
    });
    return () => cancelAnimationFrame(raf);
  }, [isActive]);

  const search = useCallback((query: string, direction: 'next' | 'prev') => {
    if (!searchRef.current || !query) return;
    if (direction === 'next') {
      searchRef.current.findNext(query);
    } else {
      searchRef.current.findPrevious(query);
    }
  }, []);

  const clearSearch = useCallback(() => {
    searchRef.current?.clearDecorations();
  }, []);

  const focus = useCallback(() => {
    termRef.current?.focus();
  }, []);

  return { containerRef, hasExited, search, clearSearch, focus };
}
