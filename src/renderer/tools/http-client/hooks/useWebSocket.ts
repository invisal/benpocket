import { useCallback } from 'react';
import { produce, type Draft } from 'immer';
import type { WsEvent } from '../../../../preload/http-client/types';
import { getActiveEnvironmentVariables } from '../store/environments.store';
import { createTabScopedStore, useTabScopedState } from '../lib/tabScopedStore';
import { makeId } from '../lib/keyValueRows';
import { resolveVariables } from '../lib/variables';
import { readTabSeed } from '../lib/readTabSeed';

export type WsStatus = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'ERROR';
export type WsLogDirection = 'IN' | 'OUT' | 'SYSTEM';
/** Only meaningful when direction is 'SYSTEM' - picks which icon/color the log row renders with. */
export type WsSystemKind = 'connected' | 'disconnected' | 'error' | 'info';

export interface WsLogEntry {
  id: string;
  direction: WsLogDirection;
  systemKind?: WsSystemKind;
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
  key: (tabId) => `request-ws-${tabId}`,
  serialize: (s) => ({ url: s.url }),
  deserialize: (raw) => {
    const r = (raw ?? {}) as { url?: string };
    return { url: r.url ?? '', status: 'DISCONNECTED', messageInput: '', log: [] };
  }
});

/** Mutates `draft.log` in place - only meant to run inside a `produce()` recipe. */
function pushLog(
  draft: Draft<WsState>,
  direction: WsLogDirection,
  message: string,
  systemKind?: WsSystemKind
): void {
  draft.log.push({ id: makeId(), direction, systemKind, timestamp: Date.now(), message });
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
    wsStore.setSnapshot(tabId, (prev) =>
      produce(prev, (draft) => {
        switch (event.type) {
          case 'connecting':
            draft.status = 'CONNECTING';
            break;
          case 'open':
            draft.status = 'CONNECTED';
            pushLog(draft, 'SYSTEM', `Connected to ${draft.url}.`, 'connected');
            break;
          case 'message':
            pushLog(draft, 'IN', event.isBinary ? `[binary, base64] ${event.data}` : event.data);
            break;
          case 'error':
            draft.status = 'ERROR';
            pushLog(draft, 'SYSTEM', `Error: ${event.message}`, 'error');
            break;
          case 'close':
            draft.status = 'DISCONNECTED';
            pushLog(
              draft,
              'SYSTEM',
              `Disconnected from ${draft.url}${event.reason ? ` (${event.reason})` : ''} (code ${event.code}).`,
              'disconnected'
            );
            break;
        }
      })
    );
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

/** The WebSocket engine for a request tab: connection state + streaming log, fully independent
 * of the HTTP engine. `onEdit` (if given) fires when the URL is edited - e.g. to promote a
 * preview tab to a permanent one on first edit, mirroring useHttp's `onEdit`. */
export function useWebSocket(tabId: string, onEdit?: () => void): UseWebSocketResult {
  ensureWsListenerRegistered();

  const [state, setState] = useTabScopedState(wsStore, tabId);

  const setUrl = useCallback(
    (url: string) => {
      onEdit?.();
      setState((prev) => ({ ...prev, url }));
    },
    [setState, onEdit]
  );
  const setMessageInput = useCallback(
    (messageInput: string) => setState((prev) => ({ ...prev, messageInput })),
    [setState]
  );

  const connect = useCallback(() => {
    const current = wsStore.getSnapshot(tabId);
    const url = current.url.trim();
    if (!url || current.status === 'CONNECTING' || current.status === 'CONNECTED') return;

    const resolvedUrl = resolveVariables(url, getActiveEnvironmentVariables());
    setState((prev) =>
      produce(prev, (draft) => {
        draft.status = 'CONNECTING';
        pushLog(draft, 'SYSTEM', `Connecting to ${resolvedUrl} ...`, 'info');
      })
    );

    window.api.ws.connect({ connectionId: tabId, url: resolvedUrl }).then((ack) => {
      if (!ack.ok) {
        wsStore.setSnapshot(tabId, (prev) =>
          produce(prev, (draft) => {
            draft.status = 'ERROR';
            pushLog(draft, 'SYSTEM', `Failed to connect: ${ack.error ?? 'unknown error'}`, 'error');
          })
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
        wsStore.setSnapshot(tabId, (prev) =>
          produce(prev, (draft) => {
            draft.messageInput = '';
            pushLog(draft, 'OUT', resolvedMessage);
          })
        );
      } else {
        wsStore.setSnapshot(tabId, (prev) =>
          produce(prev, (draft) => {
            pushLog(draft, 'SYSTEM', `Failed to send: ${ack.error ?? 'unknown error'}`, 'error');
          })
        );
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
