// Shared IPC payload types for the HTTP Client tool's API testing client (HTTP + WebSocket)
// and its saved collections/environments. Lives under src/preload/http-client so it is
// picked up by both tsconfig.node.json (src/preload/**/*) and tsconfig.web.json
// (src/preload/**/*.d.ts).

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

export type HttpBodyType = 'none' | 'json' | 'text' | 'form';

export interface KeyValuePair {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
}

export interface HttpRequestPayload {
  method: HttpMethod;
  url: string;
  headers: KeyValuePair[];
  params: KeyValuePair[];
  bodyType: HttpBodyType;
  body: string;
  timeoutMs?: number;
}

export interface HttpResponsePayload {
  ok: boolean;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  durationMs: number;
  sizeBytes: number;
  body: string;
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
  method: HttpMethod;
  url: string;
  headers: KeyValuePair[];
  params: KeyValuePair[];
  bodyType: HttpBodyType;
  body: string;
  updatedAt: number;
}

export interface CollectionFolder {
  id: string;
  name: string;
  folders: CollectionFolder[];
  requests: SavedRequest[];
}

export interface Collection {
  id: string;
  name: string;
  createdAt: number;
  requests: SavedRequest[];
  folders: CollectionFolder[];
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
  /** Detected Postman schema version of the imported file, e.g. "2.1.0". "unknown" if it couldn't be determined. */
  schemaVersion?: string;
  error?: string;
}

export interface Environment {
  id: string;
  name: string;
  createdAt: number;
  variables: KeyValuePair[];
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
