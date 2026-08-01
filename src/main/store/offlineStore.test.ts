import { describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'crypto';
import { Doc, applyUpdate } from 'yjs';
import { createOfflineStore } from './offlineStore';

// safeStorage needs a real Electron runtime -- stand in with a reversible
// no-op so encrypt/decrypt round-trips work the same way in tests.
vi.mock('electron', () => ({
  safeStorage: {
    isEncryptionAvailable: () => true,
    encryptString: (value: string) => Buffer.from(value, 'utf-8'),
    decryptString: (value: Buffer) => value.toString('utf-8')
  }
}));

function makePatch(counter: number): Buffer {
  const doc = new Doc();
  let update: Uint8Array = new Uint8Array();
  doc.on('update', (u: Uint8Array) => (update = u));
  doc.transact(() => doc.getMap('root').set('counter', counter));
  return Buffer.from(update);
}

// Sequential transactions on one shared doc, so patches are causally ordered
// (same clientID) rather than concurrent, unrelated writes -- required for a
// deterministic last-write-wins merge order (mirrors
// loginReconciliation.test.ts's makeSequentialPatches). Two independent
// makePatch() calls each get their own random clientID, so which value "wins"
// a merge between them isn't guaranteed by insertion order.
function makeSequentialPatches(values: number[]): Buffer[] {
  const doc = new Doc();
  const patches: Buffer[] = [];
  doc.on('update', (update: Uint8Array) => patches.push(Buffer.from(update)));
  for (const value of values) {
    doc.transact(() => doc.getMap('root').set('counter', value));
  }
  return patches;
}

async function freshStore() {
  const store = createOfflineStore(randomUUID(), ':memory:');
  await store.open();
  return store;
}

describe('appendPatch / loadSnapshot', () => {
  it('round-trips a single patch', async () => {
    const store = await freshStore();
    await store.appendPatch('doc', makePatch(1));

    const snapshot = await store.loadSnapshot('doc');
    expect(snapshot).not.toBeNull();
    const replay = new Doc();
    applyUpdate(replay, snapshot!);
    expect(replay.getMap('root').get('counter')).toBe(1);
  });

  it('returns null for a key with no patches', async () => {
    const store = await freshStore();
    expect(await store.loadSnapshot('missing')).toBeNull();
  });

  it('merges multiple patches into one snapshot', async () => {
    const store = await freshStore();
    const [first, second] = makeSequentialPatches([1, 2]);
    await store.appendPatch('doc', first);
    await store.appendPatch('doc', second);

    const snapshot = await store.loadSnapshot('doc');
    const replay = new Doc();
    applyUpdate(replay, snapshot!);
    expect(replay.getMap('root').get('counter')).toBe(2);
  });

  it('keeps different keys independent', async () => {
    const store = await freshStore();
    await store.appendPatch('doc-a', makePatch(1));

    expect(await store.loadSnapshot('doc-b')).toBeNull();
  });
});

describe('open', () => {
  it('is idempotent -- migrations only run once and existing data survives', async () => {
    const store = createOfflineStore(randomUUID(), ':memory:');
    await store.open();
    await store.appendPatch('doc', makePatch(1));
    await store.open();

    expect(await store.loadSnapshot('doc')).not.toBeNull();
  });

  it('throws when used before open()', async () => {
    const store = createOfflineStore(randomUUID(), ':memory:');
    await expect(store.appendPatch('doc', makePatch(1))).rejects.toThrow('used before open()');
  });
});

describe('getSetting / setSetting', () => {
  it('round-trips a value', async () => {
    const store = await freshStore();
    store.setSetting('refreshToken', 'abc123');
    expect(store.getSetting('refreshToken')).toBe('abc123');
  });

  it('returns undefined for an unknown key', async () => {
    const store = await freshStore();
    expect(store.getSetting('missing')).toBeUndefined();
  });

  it('overwrites an existing value', async () => {
    const store = await freshStore();
    store.setSetting('token', 'first');
    store.setSetting('token', 'second');
    expect(store.getSetting('token')).toBe('second');
  });
});

describe('sync bookkeeping', () => {
  it('lists unpushed patches and stops listing them once marked pushed', async () => {
    const store = await freshStore();
    await store.appendPatch('doc', makePatch(1));

    const pending = store.listUnpushedPatches();
    expect(pending).toHaveLength(1);
    expect(pending[0].docKey).toBe('doc');

    store.markPushed([{ localId: pending[0].localId, remoteSeq: 5 }]);
    expect(store.listUnpushedPatches()).toHaveLength(0);
  });

  it('advances the sync cursor to the highest applied remote seq', async () => {
    const store = await freshStore();
    expect(store.getSyncCursor()).toBe(0);

    store.applyRemotePatches([
      { docKey: 'doc', remoteSeq: 3, patch: makePatch(1) },
      { docKey: 'doc', remoteSeq: 7, patch: makePatch(2) }
    ]);

    expect(store.getSyncCursor()).toBe(7);
  });

  it('ignores a remote patch whose remote_seq already exists locally', async () => {
    const store = await freshStore();
    await store.appendPatch('doc', makePatch(1));
    const [pending] = store.listUnpushedPatches();
    store.markPushed([{ localId: pending.localId, remoteSeq: 1 }]);

    // Simulates pulling back the same patch this device just pushed.
    store.applyRemotePatches([{ docKey: 'doc', remoteSeq: 1, patch: makePatch(1) }]);

    const snapshot = await store.loadSnapshot('doc');
    const replay = new Doc();
    applyUpdate(replay, snapshot!);
    expect(replay.getMap('root').get('counter')).toBe(1);
    expect(store.getSyncCursor()).toBe(1);
  });
});
