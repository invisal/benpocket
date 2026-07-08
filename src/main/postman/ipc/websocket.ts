import { ipcMain, type WebContents } from 'electron';
import WebSocket from 'ws';
import type {
  KeyValuePair,
  WsAckResult,
  WsConnectPayload,
  WsDisconnectPayload,
  WsEvent,
  WsSendPayload
} from '../../../preload/postman/types';

interface ManagedConnection {
  socket: WebSocket;
  webContents: WebContents;
}

// Live WebSocket connections keyed by a renderer-generated connection id
// (the Postman client uses its tab id), so state survives tab switches
// and re-renders in the renderer without re-connecting.
const connections = new Map<string, ManagedConnection>();

function emit(webContents: WebContents, event: WsEvent): void {
  if (webContents.isDestroyed()) return;
  webContents.send('ws:event', event);
}

function headersToRecord(headers: KeyValuePair[] | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  for (const pair of headers ?? []) {
    if (pair.enabled && pair.key.trim().length > 0) {
      result[pair.key] = pair.value;
    }
  }
  return result;
}

function teardownConnection(connectionId: string): void {
  const existing = connections.get(connectionId);
  if (!existing) return;
  existing.socket.removeAllListeners();
  try {
    if (existing.socket.readyState === WebSocket.OPEN || existing.socket.readyState === WebSocket.CONNECTING) {
      existing.socket.terminate();
    }
  } catch {
    // Socket already closed/broken - nothing to do.
  }
  connections.delete(connectionId);
}

export function registerWebSocketHandlers(): void {
  ipcMain.handle('ws:connect', (event, payload: WsConnectPayload): WsAckResult => {
    const { connectionId, url, protocols, headers } = payload;
    const webContents = event.sender;

    // Replace any prior connection sharing this id (e.g. reconnect).
    teardownConnection(connectionId);
    emit(webContents, { connectionId, type: 'connecting' });

    let socket: WebSocket;
    try {
      socket = new WebSocket(url, protocols, { headers: headersToRecord(headers) });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to construct WebSocket';
      emit(webContents, { connectionId, type: 'error', message, timestamp: Date.now() });
      return { ok: false, error: message };
    }

    connections.set(connectionId, { socket, webContents });

    socket.on('open', () => {
      emit(webContents, { connectionId, type: 'open', timestamp: Date.now() });
    });

    socket.on('message', (data, isBinary) => {
      const text = isBinary
        ? Buffer.isBuffer(data)
          ? data.toString('base64')
          : Buffer.from(data as ArrayBuffer).toString('base64')
        : data.toString('utf-8');
      emit(webContents, { connectionId, type: 'message', data: text, isBinary, timestamp: Date.now() });
    });

    socket.on('error', (err) => {
      emit(webContents, { connectionId, type: 'error', message: err.message, timestamp: Date.now() });
    });

    socket.on('close', (code, reasonBuf) => {
      emit(webContents, {
        connectionId,
        type: 'close',
        code,
        reason: reasonBuf.toString('utf-8'),
        wasClean: code === 1000,
        timestamp: Date.now()
      });
      connections.delete(connectionId);
    });

    return { ok: true };
  });

  ipcMain.handle('ws:send', (_event, payload: WsSendPayload): WsAckResult => {
    const conn = connections.get(payload.connectionId);
    if (!conn) {
      return { ok: false, error: 'No active connection for this request.' };
    }
    if (conn.socket.readyState !== WebSocket.OPEN) {
      return { ok: false, error: 'Connection is not open.' };
    }
    try {
      conn.socket.send(payload.data);
      return { ok: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send message';
      return { ok: false, error: message };
    }
  });

  ipcMain.handle('ws:disconnect', (_event, payload: WsDisconnectPayload): WsAckResult => {
    const conn = connections.get(payload.connectionId);
    if (!conn) {
      return { ok: false, error: 'Connection not found.' };
    }
    try {
      conn.socket.close(payload.code ?? 1000, payload.reason ?? '');
    } catch {
      conn.socket.terminate();
    }
    return { ok: true };
  });
}

/** Terminates every open socket. Call on app quit / window-all-closed to avoid orphaned connections. */
export function closeAllWebSocketConnections(): void {
  for (const connectionId of Array.from(connections.keys())) {
    teardownConnection(connectionId);
  }
}
