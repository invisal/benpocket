import { useCallback } from 'react';
import { createTabScopedStore, useTabScopedState } from '../lib/tabScopedStore';
import { readTabSeed } from '../lib/readTabSeed';
import type { SavedBinding } from '../types';
import { useHttp, disposeHttpTab, type UseHttpResult } from './useHttp';
import { useWebSocket, disposeWebSocketTab, type UseWebSocketResult } from './useWebSocket';

export type ProtocolTab = 'HTTP' | 'WEBSOCKET';

function createDefaultBinding(tabId: string): SavedBinding | null {
  const seed = readTabSeed(tabId);
  if (seed?.savedCollectionId && seed?.savedRequestId) {
    return { collectionId: seed.savedCollectionId, requestId: seed.savedRequestId };
  }
  return null;
}

const protocolStore = createTabScopedStore<ProtocolTab>(() => 'HTTP', {
  key: (tabId) => `postman-protocol-${tabId}`,
  serialize: (s) => s,
  deserialize: (raw) => (raw === 'WEBSOCKET' ? 'WEBSOCKET' : 'HTTP')
});

const bindingStore = createTabScopedStore<SavedBinding | null>(createDefaultBinding, {
  key: (tabId) => `postman-binding-${tabId}`,
  serialize: (s) => s,
  deserialize: (raw) => (raw as SavedBinding | null) ?? null
});

export interface UseApiClientResult {
  protocol: ProtocolTab;
  setProtocol: (protocol: ProtocolTab) => void;

  http: UseHttpResult;
  ws: UseWebSocketResult;

  /** Which saved request (if any) this tab's HTTP draft is bound to. */
  binding: SavedBinding | null;
  /** Call after successfully saving, so a repeat Save updates the same saved request. */
  bindTo: (binding: SavedBinding) => void;
}

/**
 * Composes a Postman tab's independent HTTP and WebSocket engines behind one
 * protocol switch + saved-request binding. Neither engine depends on the
 * other; this hook only wires the shared "which protocol tab is active" and
 * "which saved request is this bound to" concerns on top.
 */
export function useApiClient(tabId: string): UseApiClientResult {
  const [protocol, setProtocol] = useTabScopedState(protocolStore, tabId);
  const [binding, setBinding] = useTabScopedState(bindingStore, tabId);

  const http = useHttp(tabId);
  const ws = useWebSocket(tabId);

  const bindTo = useCallback((next: SavedBinding) => setBinding(next), [setBinding]);

  return { protocol, setProtocol, http, ws, binding, bindTo };
}

/** Call when a Postman tab is closed to release its cached client state. */
export function disposeApiClientTab(tabId: string): void {
  disposeHttpTab(tabId);
  disposeWebSocketTab(tabId);
  protocolStore.remove(tabId);
  bindingStore.remove(tabId);
}
