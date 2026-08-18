// Shared IPC payload types for the HTTP Client tool's API testing client (HTTP + WebSocket)
// and its saved collections/environments. Lives under src/preload/http-client so it is
// picked up by both tsconfig.node.json (src/preload/**/*) and tsconfig.web.json
// (src/preload/**/*.d.ts).

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

export type HttpBodyType = 'none' | 'json' | 'text' | 'form' | 'multipart';

export type RequestProtocol = 'HTTP' | 'WEBSOCKET';

export interface KeyValuePair {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
}

export type HttpAuthType = 'inherit' | 'noauth' | 'bearer' | 'basic' | 'apikey' | 'oauth2';

export interface HttpAuth {
  type: HttpAuthType;
  bearer?: { token: string };
  basic?: { username: string; password: string };
  apikey?: { key: string; value: string; in: 'header' | 'query' };
  oauth2?: { tokenUrl: string; clientId: string; clientSecret: string; scope?: string };
}

export interface OAuth2TokenRequest {
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  scope?: string;
}

export interface OAuth2TokenResult {
  ok: boolean;
  accessToken?: string;
  tokenType?: string;
  /** Seconds until expiry, as reported by the token endpoint. */
  expiresIn?: number;
  error?: string;
}

/** One part of a 'multipart' body. A 'file' part is sent by reference (the main process
 * reads it off disk at send time) - the renderer never loads file bytes into memory. */
export type MultipartField =
  | { type: 'text'; key: string; value: string }
  | { type: 'file'; key: string; filePath: string; fileName: string };

export interface HttpRequestPayload {
  method: HttpMethod;
  url: string;
  headers: KeyValuePair[];
  params: KeyValuePair[];
  bodyType: HttpBodyType;
  body: string;
  /** Only present (and only used) when bodyType is 'multipart' - takes over from `body`
   * for actually building the request so file parts can be read from disk. `body` still
   * carries a text-only preview/placeholder form for saving/exporting/Content-Type preview. */
  multipartFields?: MultipartField[];
  /** Optional so requests sent before this field existed still type-check; treat missing as 'noauth'. */
  auth?: HttpAuth;
  timeoutMs?: number;
}

export interface PickFileResult {
  filePath: string;
  fileName: string;
  size: number;
}

export interface HttpResponsePayload {
  ok: boolean;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  durationMs: number;
  sizeBytes: number;
  /** Raw response bytes, base64-encoded, so binary bodies (images, etc.) survive the IPC hop losslessly. */
  bodyBase64: string;
  url: string;
  error?: string;
}

export interface WsConnectPayload {
  connectionId: string;
  url: string;
  protocols?: string[];
  headers?: KeyValuePair[];
}

export interface WsSendPayload {
  connectionId: string;
  data: string;
}

export interface WsDisconnectPayload {
  connectionId: string;
  code?: number;
  reason?: string;
}

export interface WsAckResult {
  ok: boolean;
  error?: string;
}

export type WsEvent =
  | { connectionId: string; type: 'connecting' }
  | { connectionId: string; type: 'open'; timestamp: number }
  | { connectionId: string; type: 'message'; data: string; isBinary: boolean; timestamp: number }
  | { connectionId: string; type: 'error'; message: string; timestamp: number }
  | {
      connectionId: string;
      type: 'close';
      code: number;
      reason: string;
      wasClean: boolean;
      timestamp: number;
    };

export interface SavedRequest {
  id: string;
  name: string;
  /** Defaults to 'HTTP' for requests saved before WebSocket requests were saveable. */
  protocol: RequestProtocol;
  /** HTTP-only; holds a placeholder value for 'WEBSOCKET' requests. */
  method: HttpMethod;
  url: string;
  /** HTTP-only; empty for 'WEBSOCKET' requests. */
  headers: KeyValuePair[];
  /** HTTP-only; empty for 'WEBSOCKET' requests. */
  params: KeyValuePair[];
  /** HTTP-only; 'none' for 'WEBSOCKET' requests. */
  bodyType: HttpBodyType;
  /** HTTP-only; empty for 'WEBSOCKET' requests. */
  body: string;
  /** HTTP-only; optional so requests saved before this field existed still load - treat missing as 'noauth'. */
  auth?: HttpAuth;
  updatedAt: number;
  /** Saved responses attached to this request. Missing/undefined for requests saved before examples existed. */
  examples?: SavedExample[];
}

/** A named, saved request+response snapshot attached to a `SavedRequest`. */
export interface SavedExample {
  id: string;
  name: string;
  createdAt: number;
  /** The request as it was configured when this response was captured. */
  request: {
    method: HttpMethod;
    url: string;
    headers: KeyValuePair[];
    params: KeyValuePair[];
    bodyType: HttpBodyType;
    body: string;
    /** Optional so examples saved before this field existed still load - treat missing as 'noauth'. */
    auth?: HttpAuth;
  };
  response: HttpResponsePayload;
}

export interface CollectionFolder {
  id: string;
  name: string;
  folders: CollectionFolder[];
  requests: SavedRequest[];
  /** Auth requests in this folder inherit by default. 'inherit' here means "use the parent folder/collection's auth". Missing/undefined is treated as 'inherit'. */
  auth?: HttpAuth;
}

export interface Collection {
  id: string;
  name: string;
  createdAt: number;
  workspaceId: string;
  requests: SavedRequest[];
  folders: CollectionFolder[];
  /** The root of the inheritance chain. 'inherit'/missing resolves to 'noauth'. */
  auth?: HttpAuth;
}

export interface CreateCollectionPayload {
  name: string;
  workspaceId: string;
}

export interface RenameCollectionPayload {
  collectionId: string;
  name: string;
}

export interface DeleteCollectionPayload {
  collectionId: string;
}

export interface SaveRequestPayload {
  collectionId: string;
  request: SavedRequest;
  /** Folder to place a *new* request in. Ignored when updating a request that already exists somewhere in the tree. Omit/null for the collection root. */
  folderId?: string | null;
}

export interface RenameRequestPayload {
  collectionId: string;
  requestId: string;
  name: string;
}

export interface DeleteRequestPayload {
  collectionId: string;
  requestId: string;
}

export interface SaveExamplePayload {
  collectionId: string;
  requestId: string;
  example: SavedExample;
}

export interface RenameExamplePayload {
  collectionId: string;
  requestId: string;
  exampleId: string;
  name: string;
}

export interface DeleteExamplePayload {
  collectionId: string;
  requestId: string;
  exampleId: string;
}

export interface CreateFolderPayload {
  collectionId: string;
  /** Parent folder to nest the new folder under. Omit/null for the collection root. */
  parentFolderId?: string | null;
  name: string;
}

export interface RenameFolderPayload {
  collectionId: string;
  folderId: string;
  name: string;
}

export interface DeleteFolderPayload {
  collectionId: string;
  folderId: string;
}

export interface MoveRequestPayload {
  collectionId: string;
  requestId: string;
  /** Destination folder. Omit/null to move to the collection root. */
  targetFolderId?: string | null;
}

export interface MoveFolderPayload {
  collectionId: string;
  folderId: string;
  /** Destination parent folder. Omit/null to move to the collection root. */
  targetParentFolderId?: string | null;
}

export interface SetCollectionAuthPayload {
  collectionId: string;
  auth: HttpAuth;
}

export interface SetFolderAuthPayload {
  collectionId: string;
  folderId: string;
  auth: HttpAuth;
}

export interface ExportCollectionPayload {
  collectionId: string;
}

export interface ExportCollectionResult {
  ok: boolean;
  canceled?: boolean;
  filePath?: string;
  error?: string;
}

export interface ImportCollectionResult {
  ok: boolean;
  canceled?: boolean;
  collection?: Collection;
  /** Which file format the collection was imported from. */
  sourceFormat?: 'postman' | 'openapi' | 'insomnia';
  /** Detected schema version of the imported file - the Postman Collection schema version (e.g. "2.1.0"), the document's `openapi` version (e.g. "3.0.3"), or the Insomnia `__export_format` number (e.g. "4"), depending on `sourceFormat`. "unknown" if it couldn't be determined. */
  schemaVersion?: string;
  /** Set when the imported file had variables to carry over (Postman's collection-level `variable` array, or OpenAPI server variables with no default), written to (or merged into) an environment. */
  importedVariableCount?: number;
  /** The environment the imported variables were written to, so the renderer can activate it. Present iff `importedVariableCount` is set. */
  environmentId?: string;
  error?: string;
}

export interface Environment {
  id: string;
  name: string;
  createdAt: number;
  workspaceId: string;
  variables: KeyValuePair[];
}

export interface ExportEnvironmentPayload {
  environmentId: string;
}

export interface ExportEnvironmentResult {
  ok: boolean;
  canceled?: boolean;
  filePath?: string;
  error?: string;
}

/** A parsed Postman Environment export, not yet written to disk - held in the renderer while the user resolves a name conflict. */
export interface ImportedEnvironmentDraft {
  name: string;
  variables: KeyValuePair[];
}

export type EnvironmentImportConflictChoice = 'replace' | 'copy';

export interface ImportEnvironmentResult {
  ok: boolean;
  canceled?: boolean;
  environment?: Environment;
  /** Set when an environment with the same name already exists in the workspace - the renderer should ask the user to Replace or Copy, then call `environments.resolveImportConflict` with their choice. */
  conflict?: {
    existingId: string;
    existingName: string;
    draft: ImportedEnvironmentDraft;
  };
  error?: string;
}

export interface ResolveEnvironmentImportPayload {
  workspaceId: string;
  existingId: string;
  draft: ImportedEnvironmentDraft;
  choice: EnvironmentImportConflictChoice;
}

export interface CreateEnvironmentPayload {
  name: string;
  workspaceId: string;
}

export interface RenameEnvironmentPayload {
  environmentId: string;
  name: string;
}

export interface DeleteEnvironmentPayload {
  environmentId: string;
}

export interface SaveEnvironmentVariablesPayload {
  environmentId: string;
  variables: KeyValuePair[];
}

export interface Workspace {
  id: string;
  name: string;
  createdAt: number;
}

export interface RenameWorkspacePayload {
  workspaceId: string;
  name: string;
}

export interface DeleteWorkspacePayload {
  workspaceId: string;
}
