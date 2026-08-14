import { useCallback } from 'react';
import { createTabScopedStore, useTabScopedState } from '../lib/tabScopedStore';
import { readTabSeed } from '../lib/readTabSeed';
import { bindingStore } from '../lib/bindingStore';
import type { SavedBinding } from '../types';
import { useHttp, disposeHttpTab, type UseHttpResult } from './useHttp';
import { useWebSocket, disposeWebSocketTab, type UseWebSocketResult } from './useWebSocket';

export type ProtocolTab = 'HTTP' | 'WEBSOCKET';

function createDefaultProtocol(tabId: string): ProtocolTab {
  return readTabSeed(tabId)?.protocol === 'WEBSOCKET' ? 'WEBSOCKET' : 'HTTP';
}

const protocolStore = createTabScopedStore<ProtocolTab>(createDefaultProtocol, {
  key: (tabId) => `request-protocol-${tabId}`,
  serialize: (s) => s,
  deserialize: (raw) => (raw === 'WEBSOCKET' ? 'WEBSOCKET' : 'HTTP')
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

export interface UseApiClientOptions {
  /** Fires once per actual draft edit (HTTP fields or the WS URL) - not on send/connect or
   * undo/redo. Lets a caller collapse e.g. preview-tab-pinning into one place instead of
   * wrapping every individual setter. */
  onEdit?: () => void;
}

/**
 * Composes a request tab's independent HTTP and WebSocket engines behind one
 * protocol switch + saved-request binding. Neither engine depends on the
 * other; this hook only wires the shared "which protocol tab is active" and
 * "which saved request is this bound to" concerns on top.
 */
export function useApiClient(tabId: string, options?: UseApiClientOptions): UseApiClientResult {
  const [protocol, setProtocol] = useTabScopedState(protocolStore, tabId);
  const [binding, setBinding] = useTabScopedState(bindingStore, tabId);

  const http = useHttp(tabId, options?.onEdit);
  const ws = useWebSocket(tabId, options?.onEdit);

  const bindTo = useCallback((next: SavedBinding) => setBinding(next), [setBinding]);

  return { protocol, setProtocol, http, ws, binding, bindTo };
}

/** Call when a request tab is closed to release its cached client state. */
export function disposeApiClientTab(tabId: string): void {
  disposeHttpTab(tabId);
  disposeWebSocketTab(tabId);
  protocolStore.remove(tabId);
  bindingStore.remove(tabId);
}
