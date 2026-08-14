import { useCallback } from 'react';
import { applyPatches, enablePatches, produceWithPatches } from 'immer';
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
import { makeId } from '../lib/makeId';
import { mergeRowsFromPairs, withTrailingRow, type KeyValueRow } from '../lib/keyValueRows';
import { parseUrlEncodedBody, serializeUrlEncodedBody, type BodyPair } from '../lib/formBody';
import {
  parseMultipartRows,
  serializeMultipartRows,
  toMultipartFields,
  withTrailingMultipartRow,
  type MultipartRow
} from '../lib/multipartRows';
import type { ParsedCurlRequest } from '../lib/curlImport';
import { resolveJsonVariables, resolveRows, resolveVariables } from '../lib/variables';
import { DEFAULT_HTTP_AUTH, resolveAuth } from '../lib/auth';
import { resolveInheritedAuth } from '../lib/authInheritance';
import { getOrFetchOAuth2Token } from '../lib/oauth2TokenCache';
import { readTabSeed } from '../lib/readTabSeed';
import { bindingStore } from '../lib/bindingStore';
import {
  EMPTY_HISTORY,
  popRedo,
  popUndo,
  pushHistoryEntry,
  type RequestHistoryState
} from '../lib/requestHistory';

// Immer's patch generation (produceWithPatches/applyPatches, used below for undo/redo) is an
// opt-in plugin - must be enabled once before either is called.
enablePatches();

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
  key: (tabId) => `request-http-${tabId}`,
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

// Undo/redo history for the draft above - deliberately not persisted, so a restart starts
// with a clean history rather than trying to serialize immer Patch objects across reloads.
const historyStore = createTabScopedStore<RequestHistoryState>(() => EMPTY_HISTORY);

/** Applies an immer recipe to the draft, and (unless it was a no-op) records the resulting
 * patches as one undo step and notifies `onEdit` - the single choke point every user-facing
 * edit in this file goes through, so undo/redo and preview-tab-pinning both fall out of it
 * for free instead of needing to be wired at each call site. */
function updateHttpState(
  tabId: string,
  recipe: (draft: HttpState) => void,
  onEdit?: () => void
): void {
  const [next, patches, inversePatches] = produceWithPatches(httpStore.getSnapshot(tabId), recipe);
  if (patches.length === 0) return;
  onEdit?.();
  httpStore.setSnapshot(tabId, next);
  historyStore.setSnapshot(tabId, (h) => pushHistoryEntry(h, patches, inversePatches));
}

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
  /** Replaces method/url/params/headers/body(+auth if the curl had credentials) with a
   * parsed `curl ...` command - see RequestComposer's URL-bar paste handler. */
  importCurl: (parsed: ParsedCurlRequest) => void;
  setAuth: (auth: HttpAuth) => void;
  send: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

/** The HTTP engine for a request tab: request draft state + sending, fully independent of the
 * WebSocket engine. `onEdit` (if given) fires once per actual draft edit - not on send() or
 * undo/redo - e.g. to promote a preview tab to a permanent one on first edit. */
export function useHttp(tabId: string, onEdit?: () => void): UseHttpResult {
  const [state, setState] = useTabScopedState(httpStore, tabId);
  const [history] = useTabScopedState(historyStore, tabId);

  const setMethod = useCallback(
    (method: HttpMethod) =>
      updateHttpState(
        tabId,
        (draft) => {
          draft.method = method;
        },
        onEdit
      ),
    [tabId, onEdit]
  );

  const setUrl = useCallback(
    (url: string) =>
      updateHttpState(
        tabId,
        (draft) => {
          draft.url = url;
          draft.params = mergeParamsFromUrl(url, draft.params);
        },
        onEdit
      ),
    [tabId, onEdit]
  );

  const setBodyType = useCallback(
    (bodyType: HttpBodyType) =>
      updateHttpState(
        tabId,
        (draft) => {
          // Switching into a row-edited body type: resync `body` from whatever rows were
          // last built (possibly from a previous form/multipart session) so the
          // Content-Type/preview reflect rows rather than stale leftover text.
          if (bodyType === 'form') {
            draft.body = serializeBodyRows(bodyType, draft.bodyRows);
          } else if (bodyType === 'multipart') {
            draft.multipartRows = withTrailingMultipartRow(draft.multipartRows);
            draft.body = serializeMultipartRows(draft.multipartRows, draft.body);
          }
          draft.bodyType = bodyType;
        },
        onEdit
      ),
    [tabId, onEdit]
  );

  const setBody = useCallback(
    (body: string) =>
      updateHttpState(
        tabId,
        (draft) => {
          draft.body = body;
        },
        onEdit
      ),
    [tabId, onEdit]
  );

  const updateHeaderRow = useCallback(
    (id: string, patch: Partial<KeyValueRow>) =>
      updateHttpState(
        tabId,
        (draft) => {
          draft.headers = withTrailingRow(
            draft.headers.map((row) => (row.id === id ? { ...row, ...patch } : row))
          );
        },
        onEdit
      ),
    [tabId, onEdit]
  );

  const removeHeaderRow = useCallback(
    (id: string) =>
      updateHttpState(
        tabId,
        (draft) => {
          draft.headers = withTrailingRow(draft.headers.filter((row) => row.id !== id));
        },
        onEdit
      ),
    [tabId, onEdit]
  );

  const updateParamRow = useCallback(
    (id: string, patch: Partial<KeyValueRow>) =>
      updateHttpState(
        tabId,
        (draft) => {
          draft.params = withTrailingRow(
            draft.params.map((row) => (row.id === id ? { ...row, ...patch } : row))
          );
          draft.url = buildUrlWithParams(draft.url, draft.params);
        },
        onEdit
      ),
    [tabId, onEdit]
  );

  const removeParamRow = useCallback(
    (id: string) =>
      updateHttpState(
        tabId,
        (draft) => {
          draft.params = withTrailingRow(draft.params.filter((row) => row.id !== id));
          draft.url = buildUrlWithParams(draft.url, draft.params);
        },
        onEdit
      ),
    [tabId, onEdit]
  );

  const updateBodyRow = useCallback(
    (id: string, patch: Partial<KeyValueRow>) =>
      updateHttpState(
        tabId,
        (draft) => {
          draft.bodyRows = withTrailingRow(
            draft.bodyRows.map((row) => (row.id === id ? { ...row, ...patch } : row))
          );
          draft.body = serializeBodyRows(draft.bodyType, draft.bodyRows);
        },
        onEdit
      ),
    [tabId, onEdit]
  );

  const removeBodyRow = useCallback(
    (id: string) =>
      updateHttpState(
        tabId,
        (draft) => {
          draft.bodyRows = withTrailingRow(draft.bodyRows.filter((row) => row.id !== id));
          draft.body = serializeBodyRows(draft.bodyType, draft.bodyRows);
        },
        onEdit
      ),
    [tabId, onEdit]
  );

  const updateMultipartRow = useCallback(
    (id: string, patch: Partial<MultipartRow>) =>
      updateHttpState(
        tabId,
        (draft) => {
          draft.multipartRows = withTrailingMultipartRow(
            draft.multipartRows.map((row) => (row.id === id ? { ...row, ...patch } : row))
          );
          draft.body = serializeMultipartRows(draft.multipartRows, draft.body);
        },
        onEdit
      ),
    [tabId, onEdit]
  );

  const removeMultipartRow = useCallback(
    (id: string) =>
      updateHttpState(
        tabId,
        (draft) => {
          draft.multipartRows = withTrailingMultipartRow(
            draft.multipartRows.filter((row) => row.id !== id)
          );
          draft.body = serializeMultipartRows(draft.multipartRows, draft.body);
        },
        onEdit
      ),
    [tabId, onEdit]
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

  const importCurl = useCallback(
    (parsed: ParsedCurlRequest) =>
      updateHttpState(
        tabId,
        (draft) => {
          const headers = withTrailingRow(
            parsed.headers.map((h) => ({ id: makeId(), key: h.key, value: h.value, enabled: true }))
          );
          const bodyRows = hydrateBodyRows(parsed.bodyType, parsed.body, []);
          const multipartRows =
            parsed.bodyType === 'multipart' && parsed.multipartFields
              ? withTrailingMultipartRow(
                  parsed.multipartFields.map((f) => ({
                    id: makeId(),
                    key: f.key,
                    enabled: true,
                    fieldType: f.type,
                    value: f.type === 'text' ? f.value : '',
                    file:
                      f.type === 'file'
                        ? { filePath: f.filePath, fileName: f.fileName, size: 0 }
                        : undefined
                  }))
                )
              : withTrailingMultipartRow([]);

          draft.method = parsed.method;
          draft.url = parsed.url;
          draft.params = mergeParamsFromUrl(parsed.url, []);
          draft.headers = headers;
          // Only overwrite auth when the curl actually had credentials (-u, or a
          // Bearer/Basic Authorization header) - otherwise leave whatever was configured.
          if (parsed.auth) draft.auth = parsed.auth;
          draft.bodyType = parsed.bodyType;
          draft.body = parsed.body;
          draft.bodyRows = bodyRows;
          draft.multipartRows = multipartRows;
        },
        onEdit
      ),
    [tabId, onEdit]
  );

  const setAuth = useCallback(
    (auth: HttpAuth) =>
      updateHttpState(
        tabId,
        (draft) => {
          draft.auth = auth;
        },
        onEdit
      ),
    [tabId, onEdit]
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

  const undo = useCallback(() => {
    const popped = popUndo(historyStore.getSnapshot(tabId));
    if (!popped) return;
    httpStore.setSnapshot(tabId, (prev) => applyPatches(prev, popped.entry.inversePatches));
    historyStore.setSnapshot(tabId, popped.next);
  }, [tabId]);

  const redo = useCallback(() => {
    const popped = popRedo(historyStore.getSnapshot(tabId));
    if (!popped) return;
    httpStore.setSnapshot(tabId, (prev) => applyPatches(prev, popped.entry.patches));
    historyStore.setSnapshot(tabId, popped.next);
  }, [tabId]);

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
    importCurl,
    setAuth,
    send,
    undo,
    redo,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0
  };
}

/** Releases this tab's cached HTTP draft state. Call when the tab is closed. */
export function disposeHttpTab(tabId: string): void {
  httpStore.remove(tabId);
  historyStore.remove(tabId);
}
