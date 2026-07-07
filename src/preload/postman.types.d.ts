// Shared IPC payload types for the API testing client (HTTP + WebSocket).
// Lives under src/preload so it is picked up by both tsconfig.node.json
// (src/preload/**/*) and tsconfig.web.json (src/preload/*.d.ts).

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

export interface Collection {
  id: string;
  name: string;
  createdAt: number;
  requests: SavedRequest[];
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
