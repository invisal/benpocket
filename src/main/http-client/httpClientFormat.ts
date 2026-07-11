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
// Craftbox supports importing/exporting the Postman Collection Format v2.0.0 and v2.1.0.
// Legacy Collection Format v1 (top-level "requests"/"folders" arrays, no "item" tree) is not supported.

interface PostmanHeader {
  key: string;
  value: string;
  type?: string;
  disabled?: boolean;
}

interface PostmanQueryParam {
  key: string;
  value: string;
  disabled?: boolean;
}

interface PostmanUrl {
  raw?: string;
  host?: string[];
  path?: string[];
  query?: PostmanQueryParam[];
}

interface PostmanFormDataEntry {
  key: string;
  value?: string;
  type?: 'text' | 'file';
  disabled?: boolean;
}

interface PostmanBody {
  mode?: 'raw' | 'urlencoded' | 'formdata' | 'graphql' | 'file' | 'none';
  raw?: string;
  urlencoded?: PostmanQueryParam[];
  formdata?: PostmanFormDataEntry[];
  graphql?: { query?: string; variables?: string };
  options?: { raw?: { language?: string } };
}

interface PostmanRequest {
  method?: string;
  header?: PostmanHeader[];
  body?: PostmanBody;
  url?: string | PostmanUrl;
}

interface PostmanItem {
  name?: string;
  item?: PostmanItem[];
  request?: PostmanRequest;
}

export interface PostmanCollectionFile {
  info?: { _postman_id?: string; name?: string; schema?: string };
  item?: PostmanItem[];
  variable?: { key: string; value: string }[];
}

const HTTP_METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

function normalizeMethod(method: string | undefined): HttpMethod {
  const upper = (method ?? 'GET').toUpperCase();
  return (HTTP_METHODS as string[]).includes(upper) ? (upper as HttpMethod) : 'GET';
}

function urlToString(url: PostmanRequest['url']): string {
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

function importHeaders(headers: PostmanHeader[] | undefined): KeyValuePair[] {
  return (headers ?? [])
    .filter((h) => h.key)
    .map((h) => ({ id: randomUUID(), key: h.key, value: h.value ?? '', enabled: !h.disabled }));
}

function importBody(body: PostmanBody | undefined): { bodyType: HttpBodyType; body: string } {
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
      const lines = (body.formdata ?? []).map((f) =>
        f.type === 'file' ? `${f.key}=<file>` : `${f.key}=${f.value ?? ''}`
      );
      return { bodyType: 'text', body: lines.join('\n') };
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

function toSavedRequest(name: string, request: PostmanRequest): SavedRequest {
  const urlString = urlToString(request.url);
  const { bodyType, body } = importBody(request.body);
  return {
    id: randomUUID(),
    name,
    method: normalizeMethod(request.method),
    url: urlString,
    headers: importHeaders(request.header),
    params: toKeyValueRows(parseQueryParams(urlString)),
    bodyType,
    body,
    updatedAt: Date.now()
  };
}

/** Recursively converts a Postman `item` array into our nested requests/folders shape. A Postman item is a request if it has `request`, or a folder if it has a nested `item` array. */
function importItems(items: PostmanItem[] | undefined): {
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

export function isPostmanCollectionFile(data: unknown): data is PostmanCollectionFile {
  if (!data || typeof data !== 'object') return false;
  const record = data as Record<string, unknown>;
  return typeof record.info === 'object' && record.info !== null && Array.isArray(record.item);
}

/** Detects the legacy Postman Collection Format v1 shape (flat "requests"/"folders" arrays, no "item" tree). */
export function isLegacyPostmanV1Collection(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;
  const record = data as Record<string, unknown>;
  if (Array.isArray(record.item)) return false;
  return Array.isArray(record.requests) && Array.isArray(record.folders);
}

export type PostmanSchemaVersion = '2.0.0' | '2.1.0' | 'unknown';

/** Best-effort detection of the collection's schema version from `info.schema`. */
export function detectPostmanSchemaVersion(file: PostmanCollectionFile): PostmanSchemaVersion {
  const schema = file.info?.schema ?? '';
  if (/\/v2\.1\.0\//.test(schema)) return '2.1.0';
  if (/\/v2\.0\.0\//.test(schema)) return '2.0.0';
  return 'unknown';
}

export interface PostmanImportResult {
  collection: Collection;
  schemaVersion: PostmanSchemaVersion;
}

/** Postman Collection v2.0 / v2.1 -> our internal Collection, preserving folder nesting. */
export function importPostmanCollection(
  file: PostmanCollectionFile,
  workspaceId: string
): PostmanImportResult {
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
    schemaVersion: detectPostmanSchemaVersion(file)
  };
}

// --- Export: our internal Collection -> Postman Collection v2.1 ---

function exportHeaders(headers: KeyValuePair[]): PostmanHeader[] {
  return headers
    .filter((h) => h.key.trim())
    .map((h) => ({ key: h.key, value: h.value, type: 'text', disabled: !h.enabled }));
}

function exportBody(bodyType: HttpBodyType, body: string): PostmanBody | undefined {
  if (bodyType === 'none' || !body.trim()) return undefined;

  if (bodyType === 'form') {
    const urlencoded: PostmanQueryParam[] = body
      .split('&')
      .map((pair) => pair.split('='))
      .filter(([key]) => key)
      .map(([key, value = '']) => ({
        key: decodeURIComponent(key),
        value: decodeURIComponent(value)
      }));
    return { mode: 'urlencoded', urlencoded };
  }

  return {
    mode: 'raw',
    raw: body,
    options: { raw: { language: bodyType === 'json' ? 'json' : 'text' } }
  };
}

function exportUrl(url: string): PostmanUrl {
  const [base, queryStr] = url.split('?');
  const pathParts = base.replace(/^[a-zA-Z]+:\/\//, '').split('/');
  const host = pathParts.shift()?.split('.') ?? [];
  const query = queryStr
    ? Array.from(new URLSearchParams(queryStr).entries()).map(([key, value]) => ({ key, value }))
    : undefined;
  return { raw: url, host, path: pathParts.filter(Boolean), query };
}

function exportRequestItem(request: SavedRequest): PostmanItem {
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
}): PostmanItem[] {
  const folderItems: PostmanItem[] = container.folders.map((folder) => ({
    name: folder.name,
    item: exportItems(folder)
  }));
  const requestItems: PostmanItem[] = container.requests.map(exportRequestItem);
  return [...folderItems, ...requestItems];
}

export function exportCollectionToPostman(collection: Collection): PostmanCollectionFile {
  return {
    info: {
      _postman_id: randomUUID(),
      name: collection.name,
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
    },
    item: exportItems(collection)
  };
}
