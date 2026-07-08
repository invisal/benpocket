import { useCallback } from 'react';
import type { WsEvent } from '../../../../preload/postman/types';
import { getActiveEnvironmentVariables } from '../store/environments.store';
import { createTabScopedStore, useTabScopedState } from '../lib/tabScopedStore';
import { makeId } from '../lib/keyValueRows';
import { resolveVariables } from '../lib/variables';
import { readTabSeed } from '../lib/readTabSeed';

export type WsStatus = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'ERROR';
export type WsLogDirection = 'IN' | 'OUT' | 'SYSTEM';

export interface WsLogEntry {
  id: string;
  direction: WsLogDirection;
  timestamp: number;
  message: string;
}

export interface WsState {
  url: string;
  status: WsStatus;
  messageInput: string;
  log: WsLogEntry[];
}

function createDefaultWsState(tabId: string): WsState {
  const seed = readTabSeed(tabId);
  return {
    url: seed?.wsUrl ?? '',
    status: 'DISCONNECTED',
    messageInput: '',
    log: []
  };
}

const wsStore = createTabScopedStore<WsState>(createDefaultWsState, {
  key: (tabId) => `postman-ws-${tabId}`,
  serialize: (s) => ({ url: s.url }),
  deserialize: (raw) => {
    const r = (raw ?? {}) as { url?: string };
    return { url: r.url ?? '', status: 'DISCONNECTED', messageInput: '', log: [] };
  }
});

function appendLog(state: WsState, direction: WsLogDirection, message: string): WsState {
  const entry: WsLogEntry = { id: makeId(), direction, timestamp: Date.now(), message };
  return { ...state, log: [...state.log, entry] };
}

// A single ws:event subscription for the whole renderer, registered once at
// module load. It keeps updating a tab's cached WS state even while that
// tab isn't mounted, so the live stream log is never dropped.
let wsListenerRegistered = false;
function ensureWsListenerRegistered(): void {
  if (wsListenerRegistered) return;
  wsListenerRegistered = true;

  window.api.ws.onEvent((event: WsEvent) => {
    const tabId = event.connectionId;
    wsStore.setSnapshot(tabId, (prev) => {
      switch (event.type) {
        case 'connecting':
          return { ...prev, status: 'CONNECTING' };
        case 'open':
          return appendLog({ ...prev, status: 'CONNECTED' }, 'SYSTEM', 'Connection established.');
        case 'message':
          return appendLog(prev, 'IN', event.isBinary ? `[binary, base64] ${event.data}` : event.data);
        case 'error':
          return appendLog({ ...prev, status: 'ERROR' }, 'SYSTEM', `Error: ${event.message}`);
        case 'close':
          return appendLog(
            { ...prev, status: 'DISCONNECTED' },
            'SYSTEM',
            `Connection closed (code ${event.code}${event.reason ? `, ${event.reason}` : ''}).`
          );
        default:
          return prev;
      }
    });
  });
}

export interface UseWebSocketResult {
  state: WsState;
  setUrl: (url: string) => void;
  setMessageInput: (message: string) => void;
  connect: () => void;
  disconnect: () => void;
  sendMessage: () => void;
  clearLog: () => void;
}

/** The WebSocket engine for a Postman tab: connection state + streaming log, fully independent of the HTTP engine. */
export function useWebSocket(tabId: string): UseWebSocketResult {
  ensureWsListenerRegistered();

  const [state, setState] = useTabScopedState(wsStore, tabId);

  const setUrl = useCallback((url: string) => setState((prev) => ({ ...prev, url })), [setState]);
  const setMessageInput = useCallback(
    (messageInput: string) => setState((prev) => ({ ...prev, messageInput })),
    [setState]
  );

  const connect = useCallback(() => {
    const current = wsStore.getSnapshot(tabId);
    const url = current.url.trim();
    if (!url || current.status === 'CONNECTING' || current.status === 'CONNECTED') return;

    const resolvedUrl = resolveVariables(url, getActiveEnvironmentVariables());
    setState((prev) => appendLog({ ...prev, status: 'CONNECTING' }, 'SYSTEM', `Connecting to ${resolvedUrl} ...`));

    window.api.ws.connect({ connectionId: tabId, url: resolvedUrl }).then((ack) => {
      if (!ack.ok) {
        wsStore.setSnapshot(tabId, (prev) =>
          appendLog({ ...prev, status: 'ERROR' }, 'SYSTEM', `Failed to connect: ${ack.error ?? 'unknown error'}`)
        );
      }
    });
  }, [setState, tabId]);

  const disconnect = useCallback(() => {
    window.api.ws.disconnect({ connectionId: tabId });
  }, [tabId]);

  const sendMessage = useCallback(() => {
    const current = wsStore.getSnapshot(tabId);
    const message = current.messageInput;
    if (!message.trim() || current.status !== 'CONNECTED') return;

    const resolvedMessage = resolveVariables(message, getActiveEnvironmentVariables());

    window.api.ws.send({ connectionId: tabId, data: resolvedMessage }).then((ack) => {
      if (ack.ok) {
        wsStore.setSnapshot(tabId, (prev) => appendLog({ ...prev, messageInput: '' }, 'OUT', resolvedMessage));
      } else {
        wsStore.setSnapshot(tabId, (prev) => appendLog(prev, 'SYSTEM', `Failed to send: ${ack.error ?? 'unknown error'}`));
      }
    });
  }, [tabId]);

  const clearLog = useCallback(() => setState((prev) => ({ ...prev, log: [] })), [setState]);

  return { state, setUrl, setMessageInput, connect, disconnect, sendMessage, clearLog };
}

/** Releases this tab's cached WS state and closes its connection. Call when the tab is closed. */
export function disposeWebSocketTab(tabId: string): void {
  window.api.ws.disconnect({ connectionId: tabId });
  wsStore.remove(tabId);
}
