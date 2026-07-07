import { useLayoutStore } from '../../../src/store/layout.store';
import type { PostmanTabSeed } from '../types';

/** Reads the seed data a Postman tab was opened with (from sidebar history or a saved request), if any. */
export function readTabSeed(tabId: string): PostmanTabSeed | undefined {
  return useLayoutStore.getState().openTabs.find((t) => t.id === tabId)?.meta as PostmanTabSeed | undefined;
}
