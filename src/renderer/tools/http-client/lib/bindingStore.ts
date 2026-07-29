import { createTabScopedStore } from './tabScopedStore';
import { readTabSeed } from './readTabSeed';
import type { SavedBinding } from '../types';

function createDefaultBinding(tabId: string): SavedBinding | null {
  const seed = readTabSeed(tabId);
  if (seed?.savedCollectionId && seed?.savedRequestId) {
    return { collectionId: seed.savedCollectionId, requestId: seed.savedRequestId };
  }
  return null;
}

/**
 * Which saved request (if any) each tab's draft is bound to. Shared (not private to
 * useApiClient) so useHttp's send() can also read it, to resolve 'inherit' auth
 * against the right collection/folder without a circular import.
 */
export const bindingStore = createTabScopedStore<SavedBinding | null>(createDefaultBinding, {
  key: (tabId) => `postman-binding-${tabId}`,
  serialize: (s) => s,
  deserialize: (raw) => (raw as SavedBinding | null) ?? null
});
