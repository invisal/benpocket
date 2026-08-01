import type { SyncProvider } from './types';

/**
 * Intentionally left unimplemented -- see PLAN.md. Exists only so
 * createSyncProvider() has a real case for kind: 'remote' to construct (it
 * calls this with a RemoteProfileDescriptor, an OfflineStore, and an optional
 * ProfileConfig, none of which are used yet). Getting the local/remote/
 * mock-remote abstraction right comes first; real HTTP/PKCE/token-refresh
 * behavior (holding a DEK plus refreshToken/token, seeded from initialConfig
 * and persisted via store.setSetting) is a separate, later pass.
 */
export function createRemoteSyncProvider(): SyncProvider {
  return {
    push: async () => {
      throw new Error('not implemented');
    },
    pull: async () => {
      throw new Error('not implemented');
    },
    close: () => {}
  };
}
