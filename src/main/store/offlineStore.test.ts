import { describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'crypto';
import { Doc, applyUpdate, mergeUpdates } from 'yjs';
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

describe('loadSnapshot auto-compacting unpushed patches', () => {
  it('folds more than 5 unpushed patches into one row, preserving content', async () => {
    const store = await freshStore();
    const patches = makeSequentialPatches([1, 2, 3, 4, 5, 6]);
    for (const patch of patches) await store.appendPatch('doc', patch);

    expect(store.listUnpushedPatches()).toHaveLength(6);

    const snapshot = await store.loadSnapshot('doc');
    const replay = new Doc();
    applyUpdate(replay, snapshot!);
    expect(replay.getMap('root').get('counter')).toBe(6);

    expect(store.listUnpushedPatches()).toHaveLength(1);
  });

  it('leaves 5 or fewer unpushed patches alone', async () => {
    const store = await freshStore();
    const patches = makeSequentialPatches([1, 2, 3, 4, 5]);
    for (const patch of patches) await store.appendPatch('doc', patch);

    await store.loadSnapshot('doc');

    expect(store.listUnpushedPatches()).toHaveLength(5);
  });

  it('never folds confirmed (remote_seq IS NOT NULL) patches', async () => {
    const store = await freshStore();
    const patches = makeSequentialPatches([1, 2, 3, 4, 5, 6]);
    for (const patch of patches) await store.appendPatch('doc', patch);
    const pending = store.listUnpushedPatches();
    // Confirm the first 3, leave the other 3 (still > threshold once folded) unpushed.
    store.markPushed(
      pending.slice(0, 3).map((patch, index) => ({ localId: patch.localId, remoteSeq: index + 1 }))
    );

    await store.loadSnapshot('doc');

    // The 3 confirmed rows are untouched -- still 3 separate rows, not folded
    // into the unpushed group's single row.
    expect(store.listUnpushedPatches()).toHaveLength(3);
    const [candidate] = store.listCompactionCandidates();
    expect(candidate.upToSeq).toBe(3);
  });

  it('the folded row still counts toward listUnpushedPatches/push()', async () => {
    const store = await freshStore();
    const patches = makeSequentialPatches([1, 2, 3, 4, 5, 6]);
    for (const patch of patches) await store.appendPatch('doc', patch);

    await store.loadSnapshot('doc');
    const [merged] = store.listUnpushedPatches();
    store.markPushed([{ localId: merged.localId, remoteSeq: 1 }]);

    expect(store.listUnpushedPatches()).toHaveLength(0);
    const snapshot = await store.loadSnapshot('doc');
    const replay = new Doc();
    applyUpdate(replay, snapshot!);
    expect(replay.getMap('root').get('counter')).toBe(6);
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

  it('applyRemotePatches trims local patches and writes sync_snapshot when a pulled entry is a baseline', async () => {
    const store = await freshStore();
    const [first, second] = makeSequentialPatches([1, 2]);
    await store.appendPatch('doc', first);
    const [pending] = store.listUnpushedPatches();
    store.markPushed([{ localId: pending.localId, remoteSeq: 1 }]);

    // Simulates a device receiving a compacted baseline via pull, folding in
    // seq 1 (already known locally) plus seq 2 (new).
    const mergedBaseline = Buffer.from(mergeUpdates([first, second]));
    store.applyRemotePatches([
      { docKey: 'doc', remoteSeq: 2, patch: mergedBaseline, isBaseline: true }
    ]);

    expect(store.getSyncCursor()).toBe(2);
    const snapshot = await store.loadSnapshot('doc');
    const replay = new Doc();
    applyUpdate(replay, snapshot!);
    expect(replay.getMap('root').get('counter')).toBe(2);
  });
});

describe('listCompactionCandidates', () => {
  it('returns nothing when no patches are confirmed pushed', async () => {
    const store = await freshStore();
    await store.appendPatch('doc', makePatch(1));
    expect(store.listCompactionCandidates()).toEqual([]);
  });

  it('excludes a doc with only 1 confirmed patch', async () => {
    const store = await freshStore();
    await store.appendPatch('doc', makePatch(1));
    const [pending] = store.listUnpushedPatches();
    store.markPushed([{ localId: pending.localId, remoteSeq: 1 }]);

    expect(store.listCompactionCandidates()).toEqual([]);
  });

  it('merges only confirmed patches, excluding unpushed ones, and reports the max confirmed remote_seq', async () => {
    const store = await freshStore();
    const [first, second, third] = makeSequentialPatches([1, 2, 3]);
    await store.appendPatch('doc', first);
    await store.appendPatch('doc', second);
    await store.appendPatch('doc', third); // stays unpushed

    const pending = store.listUnpushedPatches();
    store.markPushed([
      { localId: pending[0].localId, remoteSeq: 1 },
      { localId: pending[1].localId, remoteSeq: 2 }
    ]);

    const [candidate] = store.listCompactionCandidates();
    expect(candidate.docKey).toBe('doc');
    expect(candidate.upToSeq).toBe(2);

    const replay = new Doc();
    applyUpdate(replay, candidate.baseline);
    expect(replay.getMap('root').get('counter')).toBe(2); // not 3 -- the unpushed patch is excluded
  });

  it('counts a pulled (not pushed) remote_seq row toward the group too', async () => {
    const store = await freshStore();
    const [first, second] = makeSequentialPatches([1, 2]);
    await store.appendPatch('doc', first);
    const [pending] = store.listUnpushedPatches();
    store.markPushed([{ localId: pending.localId, remoteSeq: 1 }]);
    store.applyRemotePatches([{ docKey: 'doc', remoteSeq: 2, patch: second }]);

    const [candidate] = store.listCompactionCandidates();
    expect(candidate.upToSeq).toBe(2);
  });

  it('keeps two doc keys independent', async () => {
    const store = await freshStore();
    const [aFirst, aSecond] = makeSequentialPatches([1, 2]);
    await store.appendPatch('doc-a', aFirst);
    await store.appendPatch('doc-a', aSecond);
    const [bFirst, bSecond] = makeSequentialPatches([10, 20]);
    await store.appendPatch('doc-b', bFirst);
    await store.appendPatch('doc-b', bSecond);

    const pending = store.listUnpushedPatches();
    store.markPushed(
      pending.map((patch, index) => ({ localId: patch.localId, remoteSeq: index + 1 }))
    );

    const candidates = store.listCompactionCandidates();
    expect(candidates.map((c) => c.docKey).sort()).toEqual(['doc-a', 'doc-b']);
  });
});

describe('applyCompact', () => {
  it('trims confirmed patches at or below upToSeq and loadSnapshot still returns the full merged state', async () => {
    const store = await freshStore();
    const [first, second, third] = makeSequentialPatches([1, 2, 3]);
    await store.appendPatch('doc', first);
    await store.appendPatch('doc', second);
    await store.appendPatch('doc', third);

    const pending = store.listUnpushedPatches();
    store.markPushed(
      pending.map((patch, index) => ({ localId: patch.localId, remoteSeq: index + 1 }))
    );

    const baseline = Buffer.from(mergeUpdates([first, second]));
    store.applyCompact('doc', 2, baseline);

    // Only the seq-3 patch should remain in the raw patches table now --
    // loadSnapshot must still reconstruct the full (1,2,3) state via
    // sync_snapshot + the remaining row.
    const snapshot = await store.loadSnapshot('doc');
    const replay = new Doc();
    applyUpdate(replay, snapshot!);
    expect(replay.getMap('root').get('counter')).toBe(3);
  });

  it('never touches unpushed (remote_seq IS NULL) patches', async () => {
    const store = await freshStore();
    const [first, second] = makeSequentialPatches([1, 2]);
    await store.appendPatch('doc', first);
    const [pending] = store.listUnpushedPatches();
    store.markPushed([{ localId: pending.localId, remoteSeq: 1 }]);
    await store.appendPatch('doc', second); // stays unpushed

    store.applyCompact('doc', 1, Buffer.from(mergeUpdates([first])));

    expect(store.listUnpushedPatches()).toHaveLength(1);
  });

  it('is a no-op on sync_snapshot when upToSeq is not higher than what is already stored, but still deletes the now-redundant rows', async () => {
    const store = await freshStore();
    const [first, second] = makeSequentialPatches([1, 2]);
    await store.appendPatch('doc', first);
    await store.appendPatch('doc', second);
    const pending = store.listUnpushedPatches();
    store.markPushed(
      pending.map((patch, index) => ({ localId: patch.localId, remoteSeq: index + 1 }))
    );

    store.applyCompact('doc', 2, Buffer.from(mergeUpdates([first, second])));
    // A lower upToSeq arriving afterward (e.g. a stale server ack) must not
    // regress the stored snapshot.
    store.applyCompact('doc', 1, Buffer.from(mergeUpdates([first])));

    const snapshot = await store.loadSnapshot('doc');
    const replay = new Doc();
    applyUpdate(replay, snapshot!);
    expect(replay.getMap('root').get('counter')).toBe(2);
  });
});
