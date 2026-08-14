import { useRequestTabsStore } from '../store/tabs.store';
import type { RequestTabSeed } from '../types';

/** Reads the seed data a request tab was opened with (from sidebar history or a saved request), if any. */
export function readTabSeed(tabId: string): RequestTabSeed | undefined {
  return useRequestTabsStore.getState().tabs.find((t) => t.id === tabId)?.meta;
}
