import { useCallback, useSyncExternalStore } from 'react';

interface PersistOptions<T> {
  key: (tabId: string) => string;
  serialize: (state: T) => unknown;
  deserialize: (raw: unknown, tabId: string) => T;
}

export interface TabScopedStore<T> {
  getSnapshot: (tabId: string) => T;
  setSnapshot: (tabId: string, updater: T | ((prev: T) => T)) => void;
  subscribe: (tabId: string, listener: () => void) => () => void;
  remove: (tabId: string) => void;
}

/**
 * Minimal per-tabId external store (subscribe/getSnapshot/setSnapshot).
 * Keeps request/connection state alive across React re-renders and tab
 * switches without wiring a whole new slice into the zustand layout store,
 * and lets a global event listener update state for a tab that is not
 * currently mounted (e.g. a background WebSocket keeps streaming while the
 * user is looking at a different tab).
 *
 * Optionally persists to localStorage (Electron's renderer persists this to
 * disk under userData automatically), so request drafts survive full app
 * restarts, not just in-session tab switches.
 *
 * Each Postman engine (HTTP, WebSocket, ...) creates its own independent
 * store instance from this factory - it holds no domain state itself.
 */
export function createTabScopedStore<T>(
  createDefault: (tabId: string) => T,
  persistOptions?: PersistOptions<T>
): TabScopedStore<T> {
  const cache = new Map<string, T>();
  const listeners = new Map<string, Set<() => void>>();

  function loadPersisted(tabId: string): T | undefined {
    if (!persistOptions) return undefined;
    try {
      const raw = localStorage.getItem(persistOptions.key(tabId));
      if (!raw) return undefined;
      return persistOptions.deserialize(JSON.parse(raw), tabId);
    } catch {
      return undefined;
    }
  }

  function savePersisted(tabId: string, value: T): void {
    if (!persistOptions) return;
    try {
      localStorage.setItem(persistOptions.key(tabId), JSON.stringify(persistOptions.serialize(value)));
    } catch {
      // Storage full/unavailable - draft simply won't survive a restart.
    }
  }

  function getSnapshot(tabId: string): T {
    let entry = cache.get(tabId);
    if (!entry) {
      entry = loadPersisted(tabId) ?? createDefault(tabId);
      cache.set(tabId, entry);
    }
    return entry;
  }

  function setSnapshot(tabId: string, updater: T | ((prev: T) => T)): void {
    const prev = getSnapshot(tabId);
    const next = typeof updater === 'function' ? (updater as (p: T) => T)(prev) : updater;
    cache.set(tabId, next);
    savePersisted(tabId, next);
    listeners.get(tabId)?.forEach((listener) => listener());
  }

  function subscribe(tabId: string, listener: () => void): () => void {
    let set = listeners.get(tabId);
    if (!set) {
      set = new Set();
      listeners.set(tabId, set);
    }
    set.add(listener);
    return () => set!.delete(listener);
  }

  function remove(tabId: string): void {
    cache.delete(tabId);
    listeners.delete(tabId);
    if (persistOptions) {
      try {
        localStorage.removeItem(persistOptions.key(tabId));
      } catch {
        // Ignore - nothing to clean up.
      }
    }
  }

  return { getSnapshot, setSnapshot, subscribe, remove };
}

/** React binding for a `TabScopedStore`: subscribes this component to just one tabId's slice. */
export function useTabScopedState<T>(
  store: TabScopedStore<T>,
  tabId: string
): [T, (updater: T | ((prev: T) => T)) => void] {
  const subscribe = useCallback((listener: () => void) => store.subscribe(tabId, listener), [store, tabId]);
  const getSnapshot = useCallback(() => store.getSnapshot(tabId), [store, tabId]);
  const state = useSyncExternalStore(subscribe, getSnapshot);
  const setState = useCallback(
    (updater: T | ((prev: T) => T)) => store.setSnapshot(tabId, updater),
    [store, tabId]
  );
  return [state, setState];
}
