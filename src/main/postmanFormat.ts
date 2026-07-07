import { randomUUID } from 'crypto';
import type { Collection, HttpBodyType, HttpMethod, KeyValuePair, SavedRequest } from '../preload/postman.types';

// --- Minimal Postman Collection v2.1 shapes (permissive; only the fields we read/write) ---

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
        body: JSON.stringify({ query: body.graphql?.query ?? '', variables: body.graphql?.variables ?? '' }, null, 2)
      };
    }
    default:
      return { bodyType: 'none', body: '' };
  }
}

/** Recursively flattens Postman folders into a flat request list, prefixing names with their folder path. */
function flattenItems(items: PostmanItem[] | undefined, prefix: string): { name: string; request: PostmanRequest }[] {
  const result: { name: string; request: PostmanRequest }[] = [];
  for (const item of items ?? []) {
    const name = item.name ?? 'Untitled';
    if (item.request) {
      result.push({ name: prefix ? `${prefix} / ${name}` : name, request: item.request });
    } else if (item.item) {
      result.push(...flattenItems(item.item, prefix ? `${prefix} / ${name}` : name));
    }
  }
  return result;
}

export function isPostmanCollectionFile(data: unknown): data is PostmanCollectionFile {
  if (!data || typeof data !== 'object') return false;
  const record = data as Record<string, unknown>;
  return typeof record.info === 'object' && record.info !== null && Array.isArray(record.item);
}

/** Postman Collection v2.1 -> our internal Collection. Folders are flattened (our model has no nesting). */
export function importPostmanCollection(file: PostmanCollectionFile): Collection {
  const flat = flattenItems(file.item, '');
  const requests: SavedRequest[] = flat.map(({ name, request }) => {
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
  });

  return {
    id: randomUUID(),
    name: file.info?.name?.trim() || 'Imported Collection',
    createdAt: Date.now(),
    requests
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
      .map(([key, value = '']) => ({ key: decodeURIComponent(key), value: decodeURIComponent(value) }));
    return { mode: 'urlencoded', urlencoded };
  }

  return { mode: 'raw', raw: body, options: { raw: { language: bodyType === 'json' ? 'json' : 'text' } } };
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

export function exportCollectionToPostman(collection: Collection): PostmanCollectionFile {
  return {
    info: {
      _postman_id: randomUUID(),
      name: collection.name,
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
    },
    item: collection.requests.map((request) => ({
      name: request.name,
      request: {
        method: request.method,
        header: exportHeaders(request.headers),
        body: exportBody(request.bodyType, request.body),
        url: exportUrl(request.url)
      }
    }))
  };
}
