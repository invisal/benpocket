import { useCallback, useSyncExternalStore } from 'react';
import type {
  HttpBodyType,
  HttpMethod,
  HttpResponsePayload,
  KeyValuePair,
  WsEvent
} from '../../../preload/postman.types';
import { useLayoutStore } from '../store/layout.store';
import { getActiveEnvironmentVariables } from '../store/environments.store';

export type ProtocolTab = 'HTTP' | 'WEBSOCKET';
export type WsStatus = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'ERROR';
export type WsLogDirection = 'IN' | 'OUT' | 'SYSTEM';

export interface KeyValueRow extends KeyValuePair {}

export interface HttpState {
  method: HttpMethod;
  url: string;
  headers: KeyValueRow[];
  params: KeyValueRow[];
  bodyType: HttpBodyType;
  body: string;
  isLoading: boolean;
  response: HttpResponsePayload | null;
}

export interface WsLogEntry {
  id: string;
  direction: WsLogDirection;
  timestamp: number;
  message: string;
}

export interface WsState {
  url: string;
  status: WsStatus;
  messageInput: string;
  log: WsLogEntry[];
}

/** Binds a tab to a saved request, so a repeat Save updates it in place instead of creating a duplicate. */
export interface SavedBinding {
  collectionId: string;
  requestId: string;
}

/** Shape a Postman tab's `meta` may carry when opened pre-filled (from sidebar history or a saved request). */
export interface PostmanTabSeed {
  method?: HttpMethod;
  url?: string;
  headers?: KeyValueRow[];
  params?: KeyValueRow[];
  bodyType?: HttpBodyType;
  body?: string;
  wsUrl?: string;
  savedCollectionId?: string;
  savedRequestId?: string;
}

function makeId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function blankRow(): KeyValueRow {
  return { id: makeId(), key: '', value: '', enabled: true };
}

// Postman-style UX: always keep exactly one trailing empty row ready to type into.
export function withTrailingRow(rows: KeyValueRow[]): KeyValueRow[] {
  const last = rows[rows.length - 1];
  if (!last || last.key.trim() !== '' || last.value.trim() !== '') {
    return [...rows, blankRow()];
  }
  return rows;
}

function parseQueryString(url: string): { key: string; value: string }[] {
  const qIndex = url.indexOf('?');
  if (qIndex === -1) return [];
  const queryStr = url.slice(qIndex + 1);
  if (!queryStr) return [];
  const search = new URLSearchParams(queryStr);
  const result: { key: string; value: string }[] = [];
  search.forEach((value, key) => result.push({ key, value }));
  return result;
}

// Reparses the URL's query string into Params rows, reusing existing row
// ids/enabled-state for keys that already existed so the grid doesn't jitter
// or lose toggles while the user is still typing the URL.
function mergeParamsFromUrl(url: string, existingParams: KeyValueRow[]): KeyValueRow[] {
  const parsed = parseQueryString(url);
  const pool = new Map<string, KeyValueRow[]>();
  for (const row of existingParams) {
    if (!row.key.trim()) continue;
    const bucket = pool.get(row.key) ?? [];
    bucket.push(row);
    pool.set(row.key, bucket);
  }
  const merged: KeyValueRow[] = parsed.map(({ key, value }) => {
    const bucket = pool.get(key);
    const reused = bucket?.shift();
    return reused ? { ...reused, value } : { id: makeId(), key, value, enabled: true };
  });
  return withTrailingRow(merged);
}

// Rebuilds the URL's query string from enabled Params rows, keeping the base
// path untouched. Used whenever Params are edited directly (not the URL bar).
function buildUrlWithParams(url: string, params: KeyValueRow[]): string {
  const base = url.split('?')[0];
  const enabled = params.filter((p) => p.enabled && p.key.trim().length > 0);
  if (enabled.length === 0) return base;
  const usp = new URLSearchParams();
  for (const p of enabled) usp.append(p.key, p.value);
  return `${base}?${usp.toString()}`;
}

const VARIABLE_PATTERN = /\{\{\s*([\w.-]+)\s*\}\}/g;

// Substitutes {{name}} placeholders with the active environment's matching
// variable value. Unknown/disabled variables are left untouched (visible as
// literal {{name}}) rather than silently emptied, matching Postman's UX.
function resolveVariables(text: string, variables: KeyValuePair[]): string {
  if (!text || text.indexOf('{{') === -1) return text;
  const lookup = new Map(
    variables.filter((v) => v.enabled && v.key.trim().length > 0).map((v) => [v.key, v.value])
  );
  return text.replace(VARIABLE_PATTERN, (match, name: string) => (lookup.has(name) ? lookup.get(name)! : match));
}

function resolveRows(rows: KeyValueRow[], variables: KeyValuePair[]): KeyValueRow[] {
  return rows.map((row) => ({
    ...row,
    key: resolveVariables(row.key, variables),
    value: resolveVariables(row.value, variables)
  }));
}

function readTabSeed(tabId: string): PostmanTabSeed | undefined {
  return useLayoutStore.getState().openTabs.find((t) => t.id === tabId)?.meta as PostmanTabSeed | undefined;
}

interface PersistOptions<T> {
  key: (tabId: string) => string;
  serialize: (state: T) => unknown;
  deserialize: (raw: unknown, tabId: string) => T;
}

/**
 * Minimal per-tabId external store (subscribe/getSnapshot/setSnapshot).
 * Keeps request/connection state alive across React re-renders and tab
 * switches without wiring a whole new slice into the zustand layout store,
 * and lets the global ws:event listener update state for a tab that is not
 * currently mounted (e.g. background WebSocket keeps streaming while the
 * user is looking at a different tab).
 *
 * Optionally persists to localStorage (Electron's renderer persists this to
 * disk under userData automatically), so request drafts survive full app
 * restarts, not just in-session tab switches.
 */
function createTabScopedStore<T>(createDefault: (tabId: string) => T, persistOptions?: PersistOptions<T>) {
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

function createDefaultHttpState(tabId: string): HttpState {
  const seed = readTabSeed(tabId);
  return {
    method: seed?.method ?? 'GET',
    url: seed?.url ?? '',
    headers: withTrailingRow(seed?.headers ?? []),
    params: withTrailingRow(seed?.params ?? []),
    bodyType: seed?.bodyType ?? 'none',
    body: seed?.body ?? '',
    isLoading: false,
    response: null
  };
}

function createDefaultWsState(tabId: string): WsState {
  const seed = readTabSeed(tabId);
  return {
    url: seed?.wsUrl ?? '',
    status: 'DISCONNECTED',
    messageInput: '',
    log: []
  };
}

function createDefaultBinding(tabId: string): SavedBinding | null {
  const seed = readTabSeed(tabId);
  if (seed?.savedCollectionId && seed?.savedRequestId) {
    return { collectionId: seed.savedCollectionId, requestId: seed.savedRequestId };
  }
  return null;
}

const protocolStore = createTabScopedStore<ProtocolTab>(() => 'HTTP', {
  key: (tabId) => `postman-protocol-${tabId}`,
  serialize: (s) => s,
  deserialize: (raw) => (raw === 'WEBSOCKET' ? 'WEBSOCKET' : 'HTTP')
});

const httpStore = createTabScopedStore<HttpState>(createDefaultHttpState, {
  key: (tabId) => `postman-http-${tabId}`,
  serialize: (s) => ({
    method: s.method,
    url: s.url,
    headers: s.headers,
    params: s.params,
    bodyType: s.bodyType,
    body: s.body
  }),
  deserialize: (raw) => {
    const r = (raw ?? {}) as Partial<HttpState>;
    return {
      method: r.method ?? 'GET',
      url: r.url ?? '',
      headers: withTrailingRow(r.headers ?? []),
      params: withTrailingRow(r.params ?? []),
      bodyType: r.bodyType ?? 'none',
      body: r.body ?? '',
      isLoading: false,
      response: null
    };
  }
});

const wsStore = createTabScopedStore<WsState>(createDefaultWsState, {
  key: (tabId) => `postman-ws-${tabId}`,
  serialize: (s) => ({ url: s.url }),
  deserialize: (raw) => {
    const r = (raw ?? {}) as { url?: string };
    return { url: r.url ?? '', status: 'DISCONNECTED', messageInput: '', log: [] };
  }
});

const bindingStore = createTabScopedStore<SavedBinding | null>(createDefaultBinding, {
  key: (tabId) => `postman-binding-${tabId}`,
  serialize: (s) => s,
  deserialize: (raw) => (raw as SavedBinding | null) ?? null
});

function appendLog(state: WsState, direction: WsLogDirection, message: string): WsState {
  const entry: WsLogEntry = { id: makeId(), direction, timestamp: Date.now(), message };
  return { ...state, log: [...state.log, entry] };
}

// A single ws:event subscription for the whole renderer, registered once at
// module load. It keeps updating a tab's cached WS state even while that
// tab isn't mounted, so the live stream log is never dropped.
let wsListenerRegistered = false;
function ensureWsListenerRegistered(): void {
  if (wsListenerRegistered) return;
  wsListenerRegistered = true;

  window.api.ws.onEvent((event: WsEvent) => {
    const tabId = event.connectionId;
    wsStore.setSnapshot(tabId, (prev) => {
      switch (event.type) {
        case 'connecting':
          return { ...prev, status: 'CONNECTING' };
        case 'open':
          return appendLog({ ...prev, status: 'CONNECTED' }, 'SYSTEM', 'Connection established.');
        case 'message':
          return appendLog(prev, 'IN', event.isBinary ? `[binary, base64] ${event.data}` : event.data);
        case 'error':
          return appendLog({ ...prev, status: 'ERROR' }, 'SYSTEM', `Error: ${event.message}`);
        case 'close':
          return appendLog(
            { ...prev, status: 'DISCONNECTED' },
            'SYSTEM',
            `Connection closed (code ${event.code}${event.reason ? `, ${event.reason}` : ''}).`
          );
        default:
          return prev;
      }
    });
  });
}

function useTabScopedState<T>(
  store: ReturnType<typeof createTabScopedStore<T>>,
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

export interface UseApiClientResult {
  protocol: ProtocolTab;
  setProtocol: (protocol: ProtocolTab) => void;

  http: {
    state: HttpState;
    setMethod: (method: HttpMethod) => void;
    setUrl: (url: string) => void;
    setBodyType: (bodyType: HttpBodyType) => void;
    setBody: (body: string) => void;
    updateHeaderRow: (id: string, patch: Partial<KeyValueRow>) => void;
    removeHeaderRow: (id: string) => void;
    updateParamRow: (id: string, patch: Partial<KeyValueRow>) => void;
    removeParamRow: (id: string) => void;
    send: () => void;
  };

  ws: {
    state: WsState;
    setUrl: (url: string) => void;
    setMessageInput: (message: string) => void;
    connect: () => void;
    disconnect: () => void;
    sendMessage: () => void;
    clearLog: () => void;
  };

  /** Which saved request (if any) this tab's HTTP draft is bound to. */
  binding: SavedBinding | null;
  /** Call after successfully saving, so a repeat Save updates the same saved request. */
  bindTo: (binding: SavedBinding) => void;
}

export function useApiClient(tabId: string): UseApiClientResult {
  ensureWsListenerRegistered();

  const [protocol, setProtocol] = useTabScopedState(protocolStore, tabId);
  const [httpState, setHttpState] = useTabScopedState(httpStore, tabId);
  const [wsState, setWsState] = useTabScopedState(wsStore, tabId);
  const [binding, setBinding] = useTabScopedState(bindingStore, tabId);

  const setMethod = useCallback((method: HttpMethod) => setHttpState((prev) => ({ ...prev, method })), [setHttpState]);

  const setUrl = useCallback(
    (url: string) => setHttpState((prev) => ({ ...prev, url, params: mergeParamsFromUrl(url, prev.params) })),
    [setHttpState]
  );

  const setBodyType = useCallback(
    (bodyType: HttpBodyType) => setHttpState((prev) => ({ ...prev, bodyType })),
    [setHttpState]
  );
  const setBody = useCallback((body: string) => setHttpState((prev) => ({ ...prev, body })), [setHttpState]);

  const updateHeaderRow = useCallback(
    (id: string, patch: Partial<KeyValueRow>) =>
      setHttpState((prev) => ({
        ...prev,
        headers: withTrailingRow(prev.headers.map((row) => (row.id === id ? { ...row, ...patch } : row)))
      })),
    [setHttpState]
  );

  const removeHeaderRow = useCallback(
    (id: string) =>
      setHttpState((prev) => ({ ...prev, headers: withTrailingRow(prev.headers.filter((row) => row.id !== id)) })),
    [setHttpState]
  );

  const updateParamRow = useCallback(
    (id: string, patch: Partial<KeyValueRow>) =>
      setHttpState((prev) => {
        const nextParams = withTrailingRow(prev.params.map((row) => (row.id === id ? { ...row, ...patch } : row)));
        return { ...prev, params: nextParams, url: buildUrlWithParams(prev.url, nextParams) };
      }),
    [setHttpState]
  );

  const removeParamRow = useCallback(
    (id: string) =>
      setHttpState((prev) => {
        const nextParams = withTrailingRow(prev.params.filter((row) => row.id !== id));
        return { ...prev, params: nextParams, url: buildUrlWithParams(prev.url, nextParams) };
      }),
    [setHttpState]
  );

  const send = useCallback(() => {
    const current = httpStore.getSnapshot(tabId);
    const url = current.url.trim();
    if (!url) return;

    setHttpState((prev) => ({ ...prev, isLoading: true }));

    const variables = getActiveEnvironmentVariables();
    const resolvedUrl = resolveVariables(url, variables);

    window.api.http
      .send({
        method: current.method,
        url: resolvedUrl,
        headers: resolveRows(current.headers, variables),
        params: resolveRows(current.params, variables),
        bodyType: current.bodyType,
        body: resolveVariables(current.body, variables),
        timeoutMs: 30000
      })
      .then((response) => {
        httpStore.setSnapshot(tabId, (prev) => ({ ...prev, isLoading: false, response }));
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : 'Unknown error while sending request.';
        httpStore.setSnapshot(tabId, (prev) => ({
          ...prev,
          isLoading: false,
          response: {
            ok: false,
            status: 0,
            statusText: 'Client Error',
            headers: {},
            durationMs: 0,
            sizeBytes: 0,
            body: '',
            url,
            error: message
          }
        }));
      });
  }, [setHttpState, tabId]);

  const setWsUrl = useCallback((url: string) => setWsState((prev) => ({ ...prev, url })), [setWsState]);
  const setMessageInput = useCallback(
    (messageInput: string) => setWsState((prev) => ({ ...prev, messageInput })),
    [setWsState]
  );

  const connect = useCallback(() => {
    const current = wsStore.getSnapshot(tabId);
    const url = current.url.trim();
    if (!url || current.status === 'CONNECTING' || current.status === 'CONNECTED') return;

    const resolvedUrl = resolveVariables(url, getActiveEnvironmentVariables());
    setWsState((prev) => appendLog({ ...prev, status: 'CONNECTING' }, 'SYSTEM', `Connecting to ${resolvedUrl} ...`));

    window.api.ws.connect({ connectionId: tabId, url: resolvedUrl }).then((ack) => {
      if (!ack.ok) {
        wsStore.setSnapshot(tabId, (prev) =>
          appendLog({ ...prev, status: 'ERROR' }, 'SYSTEM', `Failed to connect: ${ack.error ?? 'unknown error'}`)
        );
      }
    });
  }, [setWsState, tabId]);

  const disconnect = useCallback(() => {
    window.api.ws.disconnect({ connectionId: tabId });
  }, [tabId]);

  const sendMessage = useCallback(() => {
    const current = wsStore.getSnapshot(tabId);
    const message = current.messageInput;
    if (!message.trim() || current.status !== 'CONNECTED') return;

    const resolvedMessage = resolveVariables(message, getActiveEnvironmentVariables());

    window.api.ws.send({ connectionId: tabId, data: resolvedMessage }).then((ack) => {
      if (ack.ok) {
        wsStore.setSnapshot(tabId, (prev) => appendLog({ ...prev, messageInput: '' }, 'OUT', resolvedMessage));
      } else {
        wsStore.setSnapshot(tabId, (prev) =>
          appendLog(prev, 'SYSTEM', `Failed to send: ${ack.error ?? 'unknown error'}`)
        );
      }
    });
  }, [tabId]);

  const clearLog = useCallback(() => setWsState((prev) => ({ ...prev, log: [] })), [setWsState]);

  const bindTo = useCallback((next: SavedBinding) => setBinding(next), [setBinding]);

  return {
    protocol,
    setProtocol,
    http: {
      state: httpState,
      setMethod,
      setUrl,
      setBodyType,
      setBody,
      updateHeaderRow,
      removeHeaderRow,
      updateParamRow,
      removeParamRow,
      send
    },
    ws: {
      state: wsState,
      setUrl: setWsUrl,
      setMessageInput,
      connect,
      disconnect,
      sendMessage,
      clearLog
    },
    binding,
    bindTo
  };
}

/** Call when a Postman tab is closed to release its cached client state. */
export function disposeApiClientTab(tabId: string): void {
  window.api.ws.disconnect({ connectionId: tabId });
  protocolStore.remove(tabId);
  httpStore.remove(tabId);
  wsStore.remove(tabId);
  bindingStore.remove(tabId);
}
