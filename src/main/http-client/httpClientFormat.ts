import { randomUUID } from 'crypto';
import type {
  Collection,
  CollectionFolder,
  HttpAuth,
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

// --- OpenAPI 3.x document import (permissive; only the fields we read) ---
// benpocket supports importing OpenAPI Description v3.0/v3.1 documents (JSON or YAML),
// generating one request per operation and grouping them into folders by tag.
// Swagger / OpenAPI v2.0 ("swagger": "2.0") is not supported.

interface OpenApiSchema {
  type?: string;
  properties?: Record<string, OpenApiSchema>;
  items?: OpenApiSchema;
  example?: unknown;
  default?: unknown;
  enum?: unknown[];
  format?: string;
  $ref?: string;
}

interface OpenApiParameter {
  name?: string;
  in?: 'query' | 'header' | 'path' | 'cookie';
  required?: boolean;
  schema?: OpenApiSchema;
  example?: unknown;
}

interface OpenApiExample {
  value?: unknown;
}

interface OpenApiMediaType {
  schema?: OpenApiSchema;
  example?: unknown;
  examples?: Record<string, OpenApiExample>;
}

interface OpenApiRequestBody {
  content?: Record<string, OpenApiMediaType>;
}

type OpenApiSecurityRequirement = Record<string, string[]>;

interface OpenApiOperation {
  summary?: string;
  operationId?: string;
  tags?: string[];
  parameters?: OpenApiParameter[];
  requestBody?: OpenApiRequestBody;
  security?: OpenApiSecurityRequirement[];
}

const OPENAPI_METHODS = [
  ['get', 'GET'],
  ['post', 'POST'],
  ['put', 'PUT'],
  ['patch', 'PATCH'],
  ['delete', 'DELETE'],
  ['head', 'HEAD'],
  ['options', 'OPTIONS']
] as const;

interface OpenApiPathItem {
  parameters?: OpenApiParameter[];
  get?: OpenApiOperation;
  post?: OpenApiOperation;
  put?: OpenApiOperation;
  patch?: OpenApiOperation;
  delete?: OpenApiOperation;
  head?: OpenApiOperation;
  options?: OpenApiOperation;
}

interface OpenApiServerVariable {
  default?: string;
}

interface OpenApiServer {
  url?: string;
  variables?: Record<string, OpenApiServerVariable>;
}

interface OpenApiSecurityScheme {
  type?: string;
  scheme?: string;
  in?: 'header' | 'query' | 'cookie';
  name?: string;
}

export interface OpenApiFile {
  openapi?: string;
  info?: { title?: string };
  servers?: OpenApiServer[];
  paths?: Record<string, OpenApiPathItem>;
  components?: {
    schemas?: Record<string, OpenApiSchema>;
    securitySchemes?: Record<string, OpenApiSecurityScheme>;
  };
  security?: OpenApiSecurityRequirement[];
}

/** Detects an OpenAPI Description v3.x document ("openapi": "3.x.x" + a "paths" object). */
export function isOpenApiFile(data: unknown): data is OpenApiFile {
  if (!data || typeof data !== 'object') return false;
  const record = data as Record<string, unknown>;
  return (
    typeof record.openapi === 'string' &&
    /^3\.\d+\.\d+/.test(record.openapi) &&
    typeof record.paths === 'object' &&
    record.paths !== null
  );
}

/** Detects a Swagger / OpenAPI v2.0 document ("swagger": "2.0"), which uses a different (unsupported) request/parameter shape. */
export function isSwaggerV2File(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;
  const record = data as Record<string, unknown>;
  return typeof record.swagger === 'string' && record.swagger.startsWith('2.');
}

/** Turns an OpenAPI `{param}` path template into this app's `{{param}}` variable token syntax. */
function convertPathTemplate(path: string): string {
  return path.replace(/\{([^}/]+)\}/g, '{{$1}}');
}

/** First server's URL, substituting any variable with a declared default, or this app's `{{name}}` token when it has none. */
function resolveServerUrl(servers: OpenApiServer[] | undefined): string {
  const server = servers?.[0];
  if (!server?.url) return '';
  let url = server.url;
  for (const [name, variable] of Object.entries(server.variables ?? {})) {
    url = url.replace(`{${name}}`, variable.default || `{{${name}}}`);
  }
  return url.replace(/\/$/, '');
}

/** Server variables with no declared default - the base URL keeps a `{{name}}` token for these, so they need a (blank) environment entry for the user to fill in. */
function extractServerVariables(servers: OpenApiServer[] | undefined): KeyValuePair[] {
  const variables = servers?.[0]?.variables ?? {};
  return Object.keys(variables)
    .filter((name) => !variables[name].default)
    .map((name) => ({ id: randomUUID(), key: name, value: '', enabled: true }));
}

/** Merges a path item's shared parameters with an operation's own, the operation's taking precedence for the same name+location. */
function mergeParameters(
  pathLevel: OpenApiParameter[] | undefined,
  opLevel: OpenApiParameter[] | undefined
): OpenApiParameter[] {
  const merged = new Map<string, OpenApiParameter>();
  for (const p of [...(pathLevel ?? []), ...(opLevel ?? [])]) {
    if (p.name && p.in) merged.set(`${p.in}:${p.name}`, p);
  }
  return [...merged.values()];
}

/** A parameter's example/default if declared, else this app's `{{name}}` variable token as a fill-in placeholder. */
function paramValueToken(p: OpenApiParameter): string {
  const example = p.example ?? p.schema?.example ?? p.schema?.default;
  if (example !== undefined && example !== null) return String(example);
  return `{{${p.name}}}`;
}

function buildRequestUrl(baseUrl: string, path: string, queryParams: OpenApiParameter[]): string {
  const url = `${baseUrl}${convertPathTemplate(path)}`;
  if (queryParams.length === 0) return url;
  const query = queryParams.map((p) => `${p.name}=${paramValueToken(p)}`).join('&');
  return `${url}?${query}`;
}

function resolveSchemaRef(
  ref: string,
  schemas: Record<string, OpenApiSchema>
): OpenApiSchema | undefined {
  const match = /^#\/components\/schemas\/(.+)$/.exec(ref);
  return match ? schemas[match[1]] : undefined;
}

/** Generates a representative JSON value for a schema: its own example/default/enum if present, else a recursively-built stub from its shape. `seen` guards against `$ref` cycles. */
function exampleFromSchema(
  schema: OpenApiSchema | undefined,
  schemas: Record<string, OpenApiSchema>,
  seen: Set<string> = new Set(),
  depth = 0
): unknown {
  if (!schema || depth > 6) return null;

  if (schema.$ref) {
    if (seen.has(schema.$ref)) return null;
    return exampleFromSchema(
      resolveSchemaRef(schema.$ref, schemas),
      schemas,
      new Set(seen).add(schema.$ref),
      depth + 1
    );
  }
  if (schema.example !== undefined) return schema.example;
  if (schema.default !== undefined) return schema.default;
  if (schema.enum?.length) return schema.enum[0];

  if (schema.properties) {
    const obj: Record<string, unknown> = {};
    for (const [key, propSchema] of Object.entries(schema.properties)) {
      obj[key] = exampleFromSchema(propSchema, schemas, seen, depth + 1);
    }
    return obj;
  }

  switch (schema.type) {
    case 'array':
      return [exampleFromSchema(schema.items, schemas, seen, depth + 1)];
    case 'integer':
    case 'number':
      return 0;
    case 'boolean':
      return true;
    case 'string':
      if (schema.format === 'date-time') return new Date(0).toISOString();
      if (schema.format === 'date') return '2024-01-01';
      return 'string';
    case 'object':
      return {};
    default:
      return null;
  }
}

function firstExampleValue(examples: Record<string, OpenApiExample> | undefined): unknown {
  const first = examples && Object.values(examples)[0];
  return first?.value;
}

function pickBodyContent(
  content: Record<string, OpenApiMediaType> | undefined
): { mediaType: string; media: OpenApiMediaType } | undefined {
  if (!content) return undefined;
  const preferred = [
    'application/json',
    'application/x-www-form-urlencoded',
    'multipart/form-data'
  ];
  for (const mediaType of preferred) {
    if (content[mediaType]) return { mediaType, media: content[mediaType] };
  }
  const [mediaType] = Object.keys(content);
  return mediaType ? { mediaType, media: content[mediaType] } : undefined;
}

function buildOpenApiBody(
  requestBody: OpenApiRequestBody | undefined,
  schemas: Record<string, OpenApiSchema>
): { bodyType: HttpBodyType; body: string } {
  const picked = pickBodyContent(requestBody?.content);
  if (!picked) return { bodyType: 'none', body: '' };
  const { mediaType, media } = picked;
  const value =
    media.example ?? firstExampleValue(media.examples) ?? exampleFromSchema(media.schema, schemas);

  if (mediaType === 'application/x-www-form-urlencoded') {
    const record = (value ?? {}) as Record<string, unknown>;
    const pairs = Object.entries(record).map(([key, v]) => `${key}=${v ?? ''}`);
    return { bodyType: 'form', body: pairs.join('&') };
  }

  if (mediaType === 'multipart/form-data') {
    const record = (value ?? {}) as Record<string, unknown>;
    const fields = Object.entries(record).map(([key, v]) => ({ key, value: String(v ?? '') }));
    return { bodyType: 'multipart', body: buildMultipartBody(fields) };
  }

  if (mediaType === 'application/json') {
    return { bodyType: 'json', body: JSON.stringify(value ?? {}, null, 2) };
  }

  return { bodyType: 'text', body: typeof value === 'string' ? value : '' };
}

/**
 * Converts the security requirement that applies to an operation (its own `security`, falling
 * back to the document's global `security`) into this app's structured `HttpAuth`. OpenAPI
 * security schemes only describe *how* credentials are sent, never the credentials themselves,
 * so bearer/basic/apiKey values are filled in with `{{schemeName}}` variable tokens for the user
 * to resolve via an environment. oauth2/openIdConnect need a live credential exchange this
 * static import can't perform, so those are left unmapped (request falls back to 'noauth').
 */
function resolveOperationAuth(
  operationSecurity: OpenApiSecurityRequirement[] | undefined,
  globalSecurity: OpenApiSecurityRequirement[] | undefined,
  schemes: Record<string, OpenApiSecurityScheme> | undefined
): HttpAuth | undefined {
  const security = operationSecurity ?? globalSecurity;
  const requirement = security?.find((r) => Object.keys(r).length > 0);
  if (!requirement || !schemes) return undefined;

  const schemeName = Object.keys(requirement)[0];
  const scheme = schemes[schemeName];
  if (!scheme) return undefined;

  if (scheme.type === 'http' && scheme.scheme?.toLowerCase() === 'bearer') {
    return { type: 'bearer', bearer: { token: `{{${schemeName}}}` } };
  }
  if (scheme.type === 'http' && scheme.scheme?.toLowerCase() === 'basic') {
    return {
      type: 'basic',
      basic: { username: `{{${schemeName}Username}}`, password: `{{${schemeName}Password}}` }
    };
  }
  if (scheme.type === 'apiKey' && scheme.name) {
    return {
      type: 'apikey',
      apikey: {
        key: scheme.name,
        value: `{{${schemeName}}}`,
        in: scheme.in === 'query' ? 'query' : 'header'
      }
    };
  }
  return undefined;
}

function toSavedRequestFromOperation(
  method: HttpMethod,
  path: string,
  operation: OpenApiOperation,
  pathLevelParams: OpenApiParameter[] | undefined,
  baseUrl: string,
  schemas: Record<string, OpenApiSchema>,
  securitySchemes: Record<string, OpenApiSecurityScheme> | undefined,
  globalSecurity: OpenApiSecurityRequirement[] | undefined
): SavedRequest {
  const params = mergeParameters(pathLevelParams, operation.parameters);
  const queryParams = params.filter((p) => p.in === 'query' && p.name);
  const headerParams = params.filter((p) => p.in === 'header' && p.name);

  const url = buildRequestUrl(baseUrl, path, queryParams);
  const headers = headerParams.map((p) => ({
    id: randomUUID(),
    key: p.name!,
    value: paramValueToken(p),
    enabled: true
  }));
  const { bodyType, body } = buildOpenApiBody(operation.requestBody, schemas);
  const auth = resolveOperationAuth(operation.security, globalSecurity, securitySchemes);

  return {
    id: randomUUID(),
    name: operation.summary?.trim() || operation.operationId?.trim() || `${method} ${path}`,
    protocol: 'HTTP',
    method,
    url,
    headers,
    params: toKeyValueRows(parseQueryParams(url)),
    bodyType,
    body,
    auth,
    updatedAt: Date.now()
  };
}

/** Walks every operation in `paths`, grouping requests into one folder per first tag (untagged operations land at the collection root). */
function importOpenApiPaths(
  paths: Record<string, OpenApiPathItem>,
  baseUrl: string,
  schemas: Record<string, OpenApiSchema>,
  securitySchemes: Record<string, OpenApiSecurityScheme> | undefined,
  globalSecurity: OpenApiSecurityRequirement[] | undefined
): { requests: SavedRequest[]; folders: CollectionFolder[] } {
  const rootRequests: SavedRequest[] = [];
  const folderOrder: string[] = [];
  const folderRequests = new Map<string, SavedRequest[]>();

  for (const [path, pathItem] of Object.entries(paths)) {
    for (const [key, method] of OPENAPI_METHODS) {
      const operation = pathItem[key];
      if (!operation) continue;

      const request = toSavedRequestFromOperation(
        method,
        path,
        operation,
        pathItem.parameters,
        baseUrl,
        schemas,
        securitySchemes,
        globalSecurity
      );

      const tag = operation.tags?.[0]?.trim();
      if (!tag) {
        rootRequests.push(request);
        continue;
      }
      if (!folderRequests.has(tag)) {
        folderRequests.set(tag, []);
        folderOrder.push(tag);
      }
      folderRequests.get(tag)!.push(request);
    }
  }

  const folders: CollectionFolder[] = folderOrder.map((tag) => ({
    id: randomUUID(),
    name: tag,
    requests: folderRequests.get(tag)!,
    folders: []
  }));

  return { requests: rootRequests, folders };
}

export interface OpenApiImportResult {
  collection: Collection;
  /** The document's declared `openapi` version, e.g. "3.0.3". */
  openApiVersion: string;
  /** Server variables with no declared default, for the caller to write into an Environment so the base URL resolves. Empty if the server had none (or no server at all). */
  variables: KeyValuePair[];
}

/** OpenAPI v3.x document -> our internal Collection, one request per operation grouped by tag into folders. */
export function importOpenApiFile(file: OpenApiFile, workspaceId: string): OpenApiImportResult {
  const baseUrl = resolveServerUrl(file.servers);
  const schemas = file.components?.schemas ?? {};
  const { requests, folders } = importOpenApiPaths(
    file.paths ?? {},
    baseUrl,
    schemas,
    file.components?.securitySchemes,
    file.security
  );

  return {
    collection: {
      id: randomUUID(),
      name: file.info?.title?.trim() || 'Imported API',
      createdAt: Date.now(),
      workspaceId,
      requests,
      folders
    },
    openApiVersion: file.openapi ?? 'unknown',
    variables: extractServerVariables(file.servers)
  };
}
