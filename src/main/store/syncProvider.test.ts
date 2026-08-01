import { describe, expect, it } from 'vitest';
import { randomUUID } from 'crypto';
import { createLocalSyncProvider, createSyncProvider } from './syncProvider';
import type {
  LocalProfileDescriptor,
  MockRemoteProfileDescriptor,
  OfflineStore,
  RemoteProfileDescriptor
} from './types';

const now = Date.now();

// Only createSyncProvider's 'remote' case ever touches this -- a stub is
// enough since RemoteSyncProvider itself is unimplemented.
function fakeOfflineStore(): OfflineStore {
  return {
    profileId: randomUUID(),
    open: async () => {},
    close: () => {},
    appendPatch: async () => {},
    loadSnapshot: async () => null,
    getSetting: () => undefined,
    setSetting: () => {},
    listUnpushedPatches: () => [],
    markPushed: () => {},
    getSyncCursor: () => 0,
    applyRemotePatches: () => {}
  };
}

describe('createLocalSyncProvider', () => {
  it('push/pull always resolve to an empty array', async () => {
    const provider = createLocalSyncProvider();
    expect(
      await provider.push([{ localId: 1, docKey: 'doc', patch: Buffer.from(''), createdAt: now }])
    ).toEqual([]);
    expect(await provider.pull(0)).toEqual([]);
  });
});

describe('createSyncProvider', () => {
  it("constructs a LocalSyncProvider for kind: 'local'", async () => {
    const descriptor: LocalProfileDescriptor = {
      id: randomUUID(),
      name: 'Personal',
      createdAt: now,
      updatedAt: now,
      dbFile: 'x.db',
      kind: 'local'
    };
    const provider = createSyncProvider(descriptor, fakeOfflineStore());
    expect(await provider.pull(0)).toEqual([]);
  });

  it("constructs a MockSyncProvider for kind: 'mock-remote'", async () => {
    const descriptor: MockRemoteProfileDescriptor = {
      id: randomUUID(),
      name: 'Mock',
      createdAt: now,
      updatedAt: now,
      dbFile: 'x.db',
      kind: 'mock-remote',
      mockServerDbFile: ':memory:'
    };
    const provider = createSyncProvider(descriptor, fakeOfflineStore());
    expect(await provider.pull(0)).toEqual([]);
  });

  it("constructs a RemoteSyncProvider for kind: 'remote', which throws when used", async () => {
    const descriptor: RemoteProfileDescriptor = {
      id: randomUUID(),
      name: 'Remote',
      createdAt: now,
      updatedAt: now,
      dbFile: 'x.db',
      kind: 'remote',
      apiBaseUrl: 'https://example.com',
      provider: 'github'
    };
    const provider = createSyncProvider(descriptor, fakeOfflineStore());
    await expect(provider.push([])).rejects.toThrow('not implemented');
    await expect(provider.pull(0)).rejects.toThrow('not implemented');
  });
});
