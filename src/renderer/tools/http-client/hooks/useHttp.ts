import { useCallback } from 'react';
import type {
  HttpAuth,
  HttpBodyType,
  HttpMethod,
  HttpResponsePayload,
  KeyValuePair
} from '../../../../preload/http-client/types';
import { getActiveEnvironmentVariables } from '../store/environments.store';
import { useCollectionsStore } from '../store/collections.store';
import { createTabScopedStore, useTabScopedState } from '../lib/tabScopedStore';
import { mergeRowsFromPairs, withTrailingRow, type KeyValueRow } from '../lib/keyValueRows';
import { parseUrlEncodedBody, serializeUrlEncodedBody, type BodyPair } from '../lib/formBody';
import {
  parseMultipartRows,
  serializeMultipartRows,
  toMultipartFields,
  withTrailingMultipartRow,
  type MultipartRow
} from '../lib/multipartRows';
import { resolveJsonVariables, resolveRows, resolveVariables } from '../lib/variables';
import { DEFAULT_HTTP_AUTH, resolveAuth } from '../lib/auth';
import { resolveInheritedAuth } from '../lib/authInheritance';
import { getOrFetchOAuth2Token } from '../lib/oauth2TokenCache';
import { readTabSeed } from '../lib/readTabSeed';
import { bindingStore } from '../lib/bindingStore';

export interface HttpState {
  method: HttpMethod;
  url: string;
  headers: KeyValueRow[];
  params: KeyValueRow[];
  auth: HttpAuth;
  bodyType: HttpBodyType;
  body: string;
  /** Row-editor view of `body` for the 'form' body type - kept in sync with `body` in both
   * directions (see hydrateBodyRows/serializeBodyRows) so switching bodyType or reloading a
   * saved request doesn't lose row ids/enabled-state. Unused for other types. */
  bodyRows: KeyValueRow[];
  /** Row-editor view of `body` for the 'multipart' body type - separate from `bodyRows`
   * because a multipart row can carry a picked-file reference a plain KeyValueRow can't
   * represent. See lib/multipartRows.ts. Unused for other types. */
  multipartRows: MultipartRow[];
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
  return mergeRowsFromPairs(parseQueryString(url), existingParams);
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

// Parses `body` into row form for the 'form' body type, reusing `existingRows`' ids/
// enabled-state for keys that already existed (see mergeRowsFromPairs).
function hydrateBodyRows(
  bodyType: HttpBodyType,
  body: string,
  existingRows: KeyValueRow[]
): KeyValueRow[] {
  if (bodyType === 'form') return mergeRowsFromPairs(parseUrlEncodedBody(body), existingRows);
  return withTrailingRow(existingRows);
}

// The inverse of hydrateBodyRows: rebuilds the raw `body` string from rows, keeping
// templated `{{var}}` placeholders intact (they're only resolved at send() time - see
// resolveBodyForSend, which resolves the rows *before* this encoding step so a
// urlencoded value's braces don't get percent-escaped out of matchability).
function serializeBodyRows(bodyType: HttpBodyType, rows: KeyValueRow[]): string {
  if (bodyType !== 'form') return '';
  const pairs: BodyPair[] = rows
    .filter((r) => r.enabled && r.key.trim())
    .map((r) => ({ key: r.key, value: r.value }));
  return serializeUrlEncodedBody(pairs);
}

// One-time hydration for multipartRows - only reparses `body` when no live row state
// exists yet (see parseMultipartRows' own doc comment for why this isn't reused per-edit).
function hydrateMultipartRows(body: string, existingRows: MultipartRow[]): MultipartRow[] {
  if (existingRows.length > 0) return withTrailingMultipartRow(existingRows);
  return withTrailingMultipartRow(parseMultipartRows(body));
}

// multipart part values are inserted as raw text (no percent-encoding), so a flat
// resolveVariables() over the whole body works there - but urlencoded values are
// percent-encoded, which mangles a literal "{{name}}" before resolveVariables ever
// sees it. So for 'form', resolve each row's key/value first, then encode. 'multipart'
// only needs the text-only preview form here - the actual send uses resolved
// multipartFields (built separately in send(), see toMultipartFields) since file bytes
// have to be read fresh by the main process regardless of what this string says.
function resolveBodyForSend(
  bodyType: HttpBodyType,
  body: string,
  bodyRows: KeyValueRow[],
  variables: KeyValuePair[]
): string {
  if (bodyType === 'json') return resolveJsonVariables(body, variables);
  if (bodyType === 'form') {
    const resolved = resolveRows(bodyRows, variables).filter((r) => r.enabled && r.key.trim());
    return serializeUrlEncodedBody(resolved.map((r) => ({ key: r.key, value: r.value })));
  }
  return resolveVariables(body, variables);
}

function createDefaultHttpState(tabId: string): HttpState {
  const seed = readTabSeed(tabId);
  const bodyType = seed?.bodyType ?? 'none';
  const body = seed?.body ?? '';
  return {
    method: seed?.method ?? 'GET',
    url: seed?.url ?? '',
    headers: withTrailingRow(seed?.headers ?? []),
    params: withTrailingRow(seed?.params ?? []),
    auth: seed?.auth ?? DEFAULT_HTTP_AUTH,
    bodyType,
    body,
    bodyRows: hydrateBodyRows(bodyType, body, []),
    // Always hydrated (not gated on bodyType === 'multipart', unlike the initial `body`
    // parse) so switching *into* multipart later via setBodyType always finds at least
    // the trailing blank row ready to type into, same as bodyRows already does for 'form'.
    multipartRows: hydrateMultipartRows(body, []),
    isLoading: false,
    response: seed?.response ?? null
  };
}

const httpStore = createTabScopedStore<HttpState>(createDefaultHttpState, {
  key: (tabId) => `postman-http-${tabId}`,
  serialize: (s) => ({
    method: s.method,
    url: s.url,
    headers: s.headers,
    params: s.params,
    auth: s.auth,
    bodyType: s.bodyType,
    body: s.body,
    bodyRows: s.bodyRows,
    multipartRows: s.multipartRows,
    response: s.response
  }),
  deserialize: (raw, tabId) => {
    const r = (raw ?? {}) as Partial<HttpState>;
    const bodyType = r.bodyType ?? 'none';
    const body = r.body ?? '';
    return {
      method: r.method ?? 'GET',
      url: r.url ?? '',
      headers: withTrailingRow(r.headers ?? []),
      params: withTrailingRow(r.params ?? []),
      auth: r.auth ?? DEFAULT_HTTP_AUTH,
      bodyType,
      body,
      bodyRows:
        r.bodyRows && r.bodyRows.length > 0
          ? withTrailingRow(r.bodyRows)
          : hydrateBodyRows(bodyType, body, []),
      multipartRows: hydrateMultipartRows(body, r.multipartRows ?? []),
      isLoading: false,
      // Prefer whatever was actually persisted, but fall back to the tab's seed - an
      // "open saved example" tab's captured response only lives in its seed (see
      // HttpClientSidebar's openSavedExample), and previously never got read back here.
      response: r.response ?? readTabSeed(tabId)?.response ?? null
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
  updateBodyRow: (id: string, patch: Partial<KeyValueRow>) => void;
  removeBodyRow: (id: string) => void;
  updateMultipartRow: (id: string, patch: Partial<MultipartRow>) => void;
  removeMultipartRow: (id: string) => void;
  pickMultipartFile: (id: string) => Promise<void>;
  setAuth: (auth: HttpAuth) => void;
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
    (bodyType: HttpBodyType) =>
      setState((prev) => {
        // Switching into a row-edited body type: resync `body` from whatever rows were
        // last built (possibly from a previous form/multipart session) so the
        // Content-Type/preview reflect rows rather than stale leftover text.
        if (bodyType === 'form') {
          return { ...prev, bodyType, body: serializeBodyRows(bodyType, prev.bodyRows) };
        }
        if (bodyType === 'multipart') {
          const rows = withTrailingMultipartRow(prev.multipartRows);
          return {
            ...prev,
            bodyType,
            multipartRows: rows,
            body: serializeMultipartRows(rows, prev.body)
          };
        }
        return { ...prev, bodyType };
      }),
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

  const updateBodyRow = useCallback(
    (id: string, patch: Partial<KeyValueRow>) =>
      setState((prev) => {
        const nextRows = withTrailingRow(
          prev.bodyRows.map((row) => (row.id === id ? { ...row, ...patch } : row))
        );
        return { ...prev, bodyRows: nextRows, body: serializeBodyRows(prev.bodyType, nextRows) };
      }),
    [setState]
  );

  const removeBodyRow = useCallback(
    (id: string) =>
      setState((prev) => {
        const nextRows = withTrailingRow(prev.bodyRows.filter((row) => row.id !== id));
        return { ...prev, bodyRows: nextRows, body: serializeBodyRows(prev.bodyType, nextRows) };
      }),
    [setState]
  );

  const updateMultipartRow = useCallback(
    (id: string, patch: Partial<MultipartRow>) =>
      setState((prev) => {
        const nextRows = withTrailingMultipartRow(
          prev.multipartRows.map((row) => (row.id === id ? { ...row, ...patch } : row))
        );
        return {
          ...prev,
          multipartRows: nextRows,
          body: serializeMultipartRows(nextRows, prev.body)
        };
      }),
    [setState]
  );

  const removeMultipartRow = useCallback(
    (id: string) =>
      setState((prev) => {
        const nextRows = withTrailingMultipartRow(
          prev.multipartRows.filter((row) => row.id !== id)
        );
        return {
          ...prev,
          multipartRows: nextRows,
          body: serializeMultipartRows(nextRows, prev.body)
        };
      }),
    [setState]
  );

  const pickMultipartFile = useCallback(
    async (id: string): Promise<void> => {
      const picked = await window.api.http.pickFile();
      if (!picked) return;
      updateMultipartRow(id, {
        fieldType: 'file',
        value: '',
        file: { filePath: picked.filePath, fileName: picked.fileName, size: picked.size }
      });
    },
    [updateMultipartRow]
  );

  const setAuth = useCallback(
    (auth: HttpAuth) => setState((prev) => ({ ...prev, auth })),
    [setState]
  );

  const send = useCallback(() => {
    const current = httpStore.getSnapshot(tabId);
    const url = current.url.trim();
    if (!url) return;

    setState((prev) => ({ ...prev, isLoading: true }));

    void (async () => {
      try {
        const variables = getActiveEnvironmentVariables();
        const resolvedUrl = resolveVariables(url, variables);

        const binding = bindingStore.getSnapshot(tabId);
        const collection = binding
          ? useCollectionsStore.getState().collections.find((c) => c.id === binding.collectionId)
          : undefined;
        const inherited = resolveInheritedAuth(current.auth, collection, binding?.requestId);
        const resolved = resolveAuth(inherited, variables);
        const auth: HttpAuth =
          resolved.type === 'oauth2' && resolved.oauth2
            ? {
                type: 'bearer',
                bearer: { token: (await getOrFetchOAuth2Token(resolved.oauth2)).accessToken }
              }
            : resolved;

        const response = await window.api.http.send({
          method: current.method,
          url: resolvedUrl,
          headers: resolveRows(current.headers, variables),
          params: resolveRows(current.params, variables),
          auth,
          bodyType: current.bodyType,
          body: resolveBodyForSend(current.bodyType, current.body, current.bodyRows, variables),
          multipartFields:
            current.bodyType === 'multipart'
              ? toMultipartFields(current.multipartRows, (key, value) => ({
                  key: resolveVariables(key, variables),
                  value: resolveVariables(value, variables)
                }))
              : undefined,
          timeoutMs: 30000
        });
        httpStore.setSnapshot(tabId, (prev) => ({ ...prev, isLoading: false, response }));
      } catch (err: unknown) {
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
      }
    })();
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
    updateBodyRow,
    removeBodyRow,
    updateMultipartRow,
    removeMultipartRow,
    pickMultipartFile,
    setAuth,
    send
  };
}

/** Releases this tab's cached HTTP draft state. Call when the tab is closed. */
export function disposeHttpTab(tabId: string): void {
  httpStore.remove(tabId);
}
