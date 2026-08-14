import { randomUUID } from 'crypto';
import type {
  Collection,
  CollectionFolder,
  HttpBodyType,
  HttpMethod,
  KeyValuePair,
  SavedRequest
} from '../../preload/http-client/types';

// --- Minimal Postman Collection v2.0 / v2.1 shapes (permissive; only the fields we read/write) ---
// benpocket supports importing/exporting the Postman Collection Format v2.0.0 and v2.1.0.
// Legacy Collection Format v1 (top-level "requests"/"folders" arrays, no "item" tree) is not supported.

interface CollectionFileHeader {
  key: string;
  value: string;
  type?: string;
  disabled?: boolean;
}

interface CollectionFileQueryParam {
  key: string;
  value: string;
  disabled?: boolean;
}

interface CollectionFileUrl {
  raw?: string;
  host?: string[];
  path?: string[];
  query?: CollectionFileQueryParam[];
}

interface CollectionFileFormDataEntry {
  key: string;
  value?: string;
  type?: 'text' | 'file';
  disabled?: boolean;
}

interface CollectionFileBody {
  mode?: 'raw' | 'urlencoded' | 'formdata' | 'graphql' | 'file' | 'none';
  raw?: string;
  urlencoded?: CollectionFileQueryParam[];
  formdata?: CollectionFileFormDataEntry[];
  graphql?: { query?: string; variables?: string };
  options?: { raw?: { language?: string } };
}

interface CollectionFileAuthParam {
  key: string;
  value?: string;
  type?: string;
}

interface CollectionFileAuth {
  type?: string;
  bearer?: CollectionFileAuthParam[];
  basic?: CollectionFileAuthParam[];
  apikey?: CollectionFileAuthParam[];
}

interface CollectionFileRequest {
  method?: string;
  header?: CollectionFileHeader[];
  body?: CollectionFileBody;
  url?: string | CollectionFileUrl;
  auth?: CollectionFileAuth;
}

interface CollectionFileItem {
  name?: string;
  item?: CollectionFileItem[];
  request?: CollectionFileRequest;
}

interface CollectionFileVariable {
  key: string;
  value?: string;
  type?: string;
  disabled?: boolean;
}

export interface CollectionFile {
  info?: { _postman_id?: string; name?: string; schema?: string };
  item?: CollectionFileItem[];
  variable?: CollectionFileVariable[];
}

const HTTP_METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

function normalizeMethod(method: string | undefined): HttpMethod {
  const upper = (method ?? 'GET').toUpperCase();
  return (HTTP_METHODS as string[]).includes(upper) ? (upper as HttpMethod) : 'GET';
}

function urlToString(url: CollectionFileRequest['url']): string {
  if (!url) return '';
  if (typeof url === 'string') return url;
  if (url.raw) return url.raw;
  const base = (url.host ?? []).join('.');
  const pathStr = (url.path ?? []).join('/');
  return [base, pathStr].filter(Boolean).join('/');
}

function parseQueryParams(url: string): { key: string; value: string }[] {
  const qIndex = url.indexOf('?');
  if (qIndex === -1) return [];
  const search = new URLSearchParams(url.slice(qIndex + 1));
  const result: { key: string; value: string }[] = [];
  search.forEach((value, key) => result.push({ key, value }));
  return result;
}

function toKeyValueRows(pairs: { key: string; value: string }[]): KeyValuePair[] {
  return pairs.map((p) => ({ id: randomUUID(), key: p.key, value: p.value, enabled: true }));
}

function importHeaders(headers: CollectionFileHeader[] | undefined): KeyValuePair[] {
  return (headers ?? [])
    .filter((h) => h.key)
    .map((h) => ({ id: randomUUID(), key: h.key, value: h.value ?? '', enabled: !h.disabled }));
}

function findAuthParam(params: CollectionFileAuthParam[] | undefined, key: string): string {
  return params?.find((p) => p.key === key)?.value ?? '';
}

/**
 * Converts a request-level Postman `auth` block into the header it resolves to at
 * send time (what Postman itself shows greyed-out under "Authorization" -> the
 * actual `Authorization`/API-key header). Only the auth types that resolve to a
 * static header are handled here - oauth2/digest/aws-sig-v4/hawk/ntlm need a live
 * credential exchange Postman itself performs when sending, so there's no header
 * to statically import for those.
 */
function importAuthHeader(auth: CollectionFileAuth | undefined): KeyValuePair | null {
  if (!auth?.type || auth.type === 'noauth') return null;

  switch (auth.type) {
    case 'bearer': {
      const token = findAuthParam(auth.bearer, 'token');
      return token
        ? { id: randomUUID(), key: 'Authorization', value: `Bearer ${token}`, enabled: true }
        : null;
    }
    case 'basic': {
      const username = findAuthParam(auth.basic, 'username');
      const password = findAuthParam(auth.basic, 'password');
      if (!username && !password) return null;
      const encoded = Buffer.from(`${username}:${password}`).toString('base64');
      return { id: randomUUID(), key: 'Authorization', value: `Basic ${encoded}`, enabled: true };
    }
    case 'apikey': {
      const key = findAuthParam(auth.apikey, 'key');
      const value = findAuthParam(auth.apikey, 'value');
      const location = findAuthParam(auth.apikey, 'in');
      if (!key || location === 'query') return null; // query-param API keys belong in Params, not Headers.
      return { id: randomUUID(), key, value, enabled: true };
    }
    default:
      return null;
  }
}

/** Postman's collection-level `variable` array (Postman's own `{{key}}` variables) -> our `KeyValuePair[]`, the same shape environments use. */
function importCollectionVariables(
  variables: CollectionFileVariable[] | undefined
): KeyValuePair[] {
  return (variables ?? [])
    .filter((v) => v.key)
    .map((v) => ({ id: randomUUID(), key: v.key, value: v.value ?? '', enabled: !v.disabled }));
}

// Matches the wire format built by src/renderer/tools/http-client/lib/formBody.ts's
// serializeMultipartBody - kept in sync since main can't import renderer-side code.
function buildMultipartBody(fields: { key: string; value: string }[]): string {
  if (fields.length === 0) return '';
  const boundary = `----benpocketFormBoundary${randomUUID().replace(/-/g, '')}`;
  const parts = fields.map(
    (f) => `--${boundary}\r\nContent-Disposition: form-data; name="${f.key}"\r\n\r\n${f.value}`
  );
  return `${parts.join('\r\n')}\r\n--${boundary}--`;
}

function importBody(body: CollectionFileBody | undefined): {
  bodyType: HttpBodyType;
  body: string;
} {
  if (!body || !body.mode || body.mode === 'none') return { bodyType: 'none', body: '' };

  switch (body.mode) {
    case 'raw': {
      const language = body.options?.raw?.language;
      return { bodyType: language === 'json' ? 'json' : 'text', body: body.raw ?? '' };
    }
    case 'urlencoded': {
      const pairs = (body.urlencoded ?? []).filter((p) => !p.disabled);
      return { bodyType: 'form', body: pairs.map((p) => `${p.key}=${p.value}`).join('&') };
    }
    case 'formdata': {
      // File fields aren't representable without binary-body plumbing this client
      // doesn't have yet, so they're dropped rather than faked.
      const fields = (body.formdata ?? [])
        .filter((f) => f.type !== 'file' && !f.disabled)
        .map((f) => ({ key: f.key, value: f.value ?? '' }));
      return { bodyType: 'multipart', body: buildMultipartBody(fields) };
    }
    case 'graphql': {
      return {
        bodyType: 'json',
        body: JSON.stringify(
          { query: body.graphql?.query ?? '', variables: body.graphql?.variables ?? '' },
          null,
          2
        )
      };
    }
    default:
      return { bodyType: 'none', body: '' };
  }
}

function toSavedRequest(name: string, request: CollectionFileRequest): SavedRequest {
  const urlString = urlToString(request.url);
  const { bodyType, body } = importBody(request.body);
  const headers = importHeaders(request.header);
  const authHeader = importAuthHeader(request.auth);
  if (authHeader && !headers.some((h) => h.key.toLowerCase() === authHeader.key.toLowerCase())) {
    headers.push(authHeader);
  }
  return {
    id: randomUUID(),
    name,
    protocol: 'HTTP',
    method: normalizeMethod(request.method),
    url: urlString,
    headers,
    params: toKeyValueRows(parseQueryParams(urlString)),
    bodyType,
    body,
    updatedAt: Date.now()
  };
}

/** Recursively converts a Postman `item` array into our nested requests/folders shape. A Postman item is a request if it has `request`, or a folder if it has a nested `item` array. */
function importItems(items: CollectionFileItem[] | undefined): {
  requests: SavedRequest[];
  folders: CollectionFolder[];
} {
  const requests: SavedRequest[] = [];
  const folders: CollectionFolder[] = [];
  for (const item of items ?? []) {
    const name = item.name ?? 'Untitled';
    if (item.request) {
      requests.push(toSavedRequest(name, item.request));
    } else if (item.item) {
      const nested = importItems(item.item);
      folders.push({ id: randomUUID(), name, requests: nested.requests, folders: nested.folders });
    }
  }
  return { requests, folders };
}

export function isCollectionFile(data: unknown): data is CollectionFile {
  if (!data || typeof data !== 'object') return false;
  const record = data as Record<string, unknown>;
  return typeof record.info === 'object' && record.info !== null && Array.isArray(record.item);
}

/** Detects the legacy Postman Collection Format v1 shape (flat "requests"/"folders" arrays, no "item" tree). */
export function isLegacyCollectionV1File(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;
  const record = data as Record<string, unknown>;
  if (Array.isArray(record.item)) return false;
  return Array.isArray(record.requests) && Array.isArray(record.folders);
}

// --- Environment file (standalone `*.postman_environment.json` exports) ---

interface EnvironmentFileValue {
  key: string;
  value?: string;
  type?: string;
  enabled?: boolean;
}

export interface EnvironmentFile {
  id?: string;
  name?: string;
  values?: EnvironmentFileValue[];
  _postman_variable_scope?: string;
}

/** Postman environment and global-variable exports share this exact shape. */
export function isEnvironmentFile(data: unknown): data is EnvironmentFile {
  if (!data || typeof data !== 'object') return false;
  const record = data as Record<string, unknown>;
  const scope = record._postman_variable_scope;
  return (
    typeof record.name === 'string' &&
    Array.isArray(record.values) &&
    (scope === undefined || scope === 'environment' || scope === 'globals')
  );
}

export function importEnvironmentFile(file: EnvironmentFile): {
  name: string;
  variables: KeyValuePair[];
} {
  return {
    name: file.name?.trim() || 'Imported Environment',
    variables: (file.values ?? [])
      .filter((v) => v.key)
      .map((v) => ({
        id: randomUUID(),
        key: v.key,
        value: v.value ?? '',
        enabled: v.enabled !== false
      }))
  };
}

/** Our internal Environment -> standalone `*.postman_environment.json`, round-tripping with {@link importEnvironmentFile}. */
export function exportEnvironmentFile(environment: {
  id: string;
  name: string;
  variables: KeyValuePair[];
}): EnvironmentFile {
  return {
    id: environment.id,
    name: environment.name,
    values: environment.variables.map((v) => ({
      key: v.key,
      value: v.value,
      type: 'default',
      enabled: v.enabled
    })),
    _postman_variable_scope: 'environment'
  };
}

export type CollectionSchemaVersion = '2.0.0' | '2.1.0' | 'unknown';

/** Best-effort detection of the collection's schema version from `info.schema`. */
export function detectCollectionSchemaVersion(file: CollectionFile): CollectionSchemaVersion {
  const schema = file.info?.schema ?? '';
  if (/\/v2\.1\.0\//.test(schema)) return '2.1.0';
  if (/\/v2\.0\.0\//.test(schema)) return '2.0.0';
  return 'unknown';
}

export interface CollectionImportResult {
  collection: Collection;
  schemaVersion: CollectionSchemaVersion;
  /** Collection-level variables from the imported file (Postman's `variable` array), for the caller to write into an Environment. Empty if the file had none. */
  variables: KeyValuePair[];
}

/** Postman Collection v2.0 / v2.1 -> our internal Collection, preserving folder nesting. */
export function importCollectionFile(
  file: CollectionFile,
  workspaceId: string
): CollectionImportResult {
  const { requests, folders } = importItems(file.item);

  return {
    collection: {
      id: randomUUID(),
      name: file.info?.name?.trim() || 'Imported Collection',
      createdAt: Date.now(),
      workspaceId,
      requests,
      folders
    },
    schemaVersion: detectCollectionSchemaVersion(file),
    variables: importCollectionVariables(file.variable)
  };
}

// --- Export: our internal Collection -> Postman Collection v2.1 ---

function exportHeaders(headers: KeyValuePair[]): CollectionFileHeader[] {
  return headers
    .filter((h) => h.key.trim())
    .map((h) => ({ key: h.key, value: h.value, type: 'text', disabled: !h.enabled }));
}

function exportBody(bodyType: HttpBodyType, body: string): CollectionFileBody | undefined {
  if (bodyType === 'none' || !body.trim()) return undefined;

  if (bodyType === 'form') {
    const urlencoded: CollectionFileQueryParam[] = body
      .split('&')
      .map((pair) => pair.split('='))
      .filter(([key]) => key)
      .map(([key, value = '']) => ({
        key: decodeURIComponent(key),
        value: decodeURIComponent(value)
      }));
    return { mode: 'urlencoded', urlencoded };
  }

  if (bodyType === 'multipart') {
    // Mirrors src/renderer/tools/http-client/lib/multipartRows.ts's parseMultipartRows -
    // kept in sync since main can't import renderer-side code. A file row's "value" here
    // is its local disk path (see serializeMultipartRows) - exported as a bare `type:
    // 'file'` entry rather than leaking that path into a Postman "text" value, since the
    // permissive CollectionFileFormDataEntry shape below has no `src` field for it anyway.
    const boundaryMatch = /^--(\S+)/.exec(body);
    if (!boundaryMatch) return undefined;
    const marker = `--${boundaryMatch[1]}`;
    const formdata: CollectionFileFormDataEntry[] = body
      .split(marker)
      .slice(1, -1)
      .flatMap((segment): CollectionFileFormDataEntry[] => {
        const content = segment.replace(/^\r?\n/, '');
        const headerEnd = content.indexOf('\r\n\r\n');
        if (headerEnd === -1) return [];
        const headerBlock = content.slice(0, headerEnd);
        const nameMatch = /name="([^"]*)"/.exec(headerBlock);
        if (!nameMatch) return [];
        if (/filename="/.test(headerBlock)) {
          return [{ key: nameMatch[1], type: 'file' }];
        }
        const value = content.slice(headerEnd + 4).replace(/\r\n$/, '');
        return [{ key: nameMatch[1], value, type: 'text' }];
      });
    return { mode: 'formdata', formdata };
  }

  return {
    mode: 'raw',
    raw: body,
    options: { raw: { language: bodyType === 'json' ? 'json' : 'text' } }
  };
}

/** Our `KeyValuePair[]` -> Postman's collection-level `variable` array. */
function exportCollectionVariables(variables: KeyValuePair[]): CollectionFileVariable[] {
  return variables
    .filter((v) => v.key.trim())
    .map((v) => ({ key: v.key, value: v.value, type: 'string', disabled: !v.enabled }));
}

function exportUrl(url: string): CollectionFileUrl {
  const [base, queryStr] = url.split('?');
  const pathParts = base.replace(/^[a-zA-Z]+:\/\//, '').split('/');
  const host = pathParts.shift()?.split('.') ?? [];
  const query = queryStr
    ? Array.from(new URLSearchParams(queryStr).entries()).map(([key, value]) => ({ key, value }))
    : undefined;
  return { raw: url, host, path: pathParts.filter(Boolean), query };
}

function exportRequestItem(request: SavedRequest): CollectionFileItem {
  return {
    name: request.name,
    request: {
      method: request.method,
      header: exportHeaders(request.headers),
      body: exportBody(request.bodyType, request.body),
      url: exportUrl(request.url)
    }
  };
}

/** Recursively converts our nested requests/folders shape into a Postman `item` array (folders first, then requests). */
function exportItems(container: {
  requests: SavedRequest[];
  folders: CollectionFolder[];
}): CollectionFileItem[] {
  const folderItems: CollectionFileItem[] = container.folders.map((folder) => ({
    name: folder.name,
    item: exportItems(folder)
  }));
  const requestItems: CollectionFileItem[] = container.requests.map(exportRequestItem);
  return [...folderItems, ...requestItems];
}

/** `variables` is optional: the environment (if any) whose variables should travel with the exported collection, matching Postman's own collection-level `variable` array. */
export function exportCollectionFile(
  collection: Collection,
  variables?: KeyValuePair[]
): CollectionFile {
  return {
    info: {
      _postman_id: randomUUID(),
      name: collection.name,
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
    },
    item: exportItems(collection),
    ...(variables?.length ? { variable: exportCollectionVariables(variables) } : {})
  };
}
