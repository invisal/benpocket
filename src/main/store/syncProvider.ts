import type { OfflineStore, ProfileConfig, ProfileDescriptor, SyncProvider } from './types';
import { createMockSyncProvider } from './mockSyncProvider';
import { createRemoteSyncProvider } from './remoteSyncProvider';

/** kind: 'local' -- holds no state at all; nothing to push or pull. */
export function createLocalSyncProvider(): SyncProvider {
  return {
    push: async () => [],
    pull: async () => [],
    status: async (sinceSeq) => ({ hasChanges: false, latestSeq: sinceSeq, count: 0 }),
    close: () => {}
  };
}

/**
 * Not an interface -- there's only ever one implementation of this (this
 * plain switch), so it's ProfileManager's internal dispatch helper, not an
 * abstraction with multiple implementations like SyncProvider itself.
 * `initialConfig` is only meaningful the first time a profile is created --
 * the concrete provider persists whatever it needs into `store`'s settings KV
 * right then. On every later open, `initialConfig` is omitted and the
 * provider reads its own state back out of `store` instead.
 */
export function createSyncProvider(
  descriptor: ProfileDescriptor,
  store: OfflineStore,
  initialConfig?: ProfileConfig
): SyncProvider {
  switch (descriptor.kind) {
    case 'local':
      return createLocalSyncProvider();
    case 'mock-remote':
      return createMockSyncProvider(descriptor);
    case 'remote':
      return createRemoteSyncProvider(
        descriptor,
        store,
        initialConfig?.kind === 'remote' ? initialConfig : undefined
      );
  }
}
