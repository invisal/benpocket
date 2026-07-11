import { useCallback } from 'react';
import type {
  HttpBodyType,
  HttpMethod,
  HttpResponsePayload
} from '../../../../preload/http-client/types';
import { getActiveEnvironmentVariables } from '../store/environments.store';
import { createTabScopedStore, useTabScopedState } from '../lib/tabScopedStore';
import { withTrailingRow, type KeyValueRow } from '../lib/keyValueRows';
import { resolveRows, resolveVariables } from '../lib/variables';
import { readTabSeed } from '../lib/readTabSeed';

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
    return reused ? { ...reused, value } : { id: crypto.randomUUID(), key, value, enabled: true };
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

export interface UseHttpResult {
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
}

/** The HTTP engine for a Postman tab: request draft state + sending, fully independent of the WebSocket engine. */
export function useHttp(tabId: string): UseHttpResult {
  const [state, setState] = useTabScopedState(httpStore, tabId);

  const setMethod = useCallback(
    (method: HttpMethod) => setState((prev) => ({ ...prev, method })),
    [setState]
  );

  const setUrl = useCallback(
    (url: string) =>
      setState((prev) => ({ ...prev, url, params: mergeParamsFromUrl(url, prev.params) })),
    [setState]
  );

  const setBodyType = useCallback(
    (bodyType: HttpBodyType) => setState((prev) => ({ ...prev, bodyType })),
    [setState]
  );
  const setBody = useCallback(
    (body: string) => setState((prev) => ({ ...prev, body })),
    [setState]
  );

  const updateHeaderRow = useCallback(
    (id: string, patch: Partial<KeyValueRow>) =>
      setState((prev) => ({
        ...prev,
        headers: withTrailingRow(
          prev.headers.map((row) => (row.id === id ? { ...row, ...patch } : row))
        )
      })),
    [setState]
  );

  const removeHeaderRow = useCallback(
    (id: string) =>
      setState((prev) => ({
        ...prev,
        headers: withTrailingRow(prev.headers.filter((row) => row.id !== id))
      })),
    [setState]
  );

  const updateParamRow = useCallback(
    (id: string, patch: Partial<KeyValueRow>) =>
      setState((prev) => {
        const nextParams = withTrailingRow(
          prev.params.map((row) => (row.id === id ? { ...row, ...patch } : row))
        );
        return { ...prev, params: nextParams, url: buildUrlWithParams(prev.url, nextParams) };
      }),
    [setState]
  );

  const removeParamRow = useCallback(
    (id: string) =>
      setState((prev) => {
        const nextParams = withTrailingRow(prev.params.filter((row) => row.id !== id));
        return { ...prev, params: nextParams, url: buildUrlWithParams(prev.url, nextParams) };
      }),
    [setState]
  );

  const send = useCallback(() => {
    const current = httpStore.getSnapshot(tabId);
    const url = current.url.trim();
    if (!url) return;

    setState((prev) => ({ ...prev, isLoading: true }));

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
            bodyBase64: '',
            url,
            error: message
          }
        }));
      });
  }, [setState, tabId]);

  return {
    state,
    setMethod,
    setUrl,
    setBodyType,
    setBody,
    updateHeaderRow,
    removeHeaderRow,
    updateParamRow,
    removeParamRow,
    send
  };
}

/** Releases this tab's cached HTTP draft state. Call when the tab is closed. */
export function disposeHttpTab(tabId: string): void {
  httpStore.remove(tabId);
}
