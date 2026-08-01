import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomBytes } from 'crypto';
import { Doc } from 'yjs';
import { createProfileManager, type ProfileManager } from './profileManager';
import type { MockRemoteProfileDescriptor, ProfileConfig } from './types';

// Sequential transactions on one shared doc, so patches are causally ordered
// (mirrors offlineStore.test.ts's helper of the same name) -- required for
// mergeUpdates to produce a deterministic result inside listCompactionCandidates.
function makeSequentialPatches(values: number[]): Buffer[] {
  const doc = new Doc();
  const patches: Buffer[] = [];
  doc.on('update', (update: Uint8Array) => patches.push(Buffer.from(update)));
  for (const value of values) {
    doc.transact(() => doc.getMap('root').set('counter', value));
  }
  return patches;
}

function remoteConfig(): Extract<ProfileConfig, { kind: 'remote' }> {
  return {
    kind: 'remote',
    apiBaseUrl: 'https://api.example.com',
    provider: 'github',
    refreshToken: 'refresh-1',
    token: 'access-1',
    dek: randomBytes(32)
  };
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

// safeStorage needs a real Electron runtime -- stand in with a reversible
// no-op so encrypt/decrypt round-trips work the same way in tests.
vi.mock('electron', () => ({
  safeStorage: {
    isEncryptionAvailable: () => true,
    encryptString: (value: string) => Buffer.from(value, 'utf-8'),
    decryptString: (value: Buffer) => value.toString('utf-8')
  }
}));

let dir: string;
let managers: ProfileManager[];

// Tracks every manager created via newManager() so afterEach can close their
// sqlite handles before rmSync -- otherwise Windows refuses to remove the
// directory while a db file inside it is still open.
function newManager(): ProfileManager {
  const manager = createProfileManager(dir);
  managers.push(manager);
  return manager;
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'profile-manager-test-'));
  managers = [];
});

afterEach(() => {
  for (const manager of managers) manager.closeAll();
  rmSync(dir, { recursive: true, force: true });
  vi.unstubAllGlobals();
});

describe('ensureDefaultLocalProfile', () => {
  it('creates exactly one local profile on a fresh install', () => {
    const manager = newManager();
    const profile = manager.ensureDefaultLocalProfile();

    expect(profile.kind).toBe('local');
    expect(manager.list()).toHaveLength(1);
    expect(manager.getActive().id).toBe(profile.id);
  });

  it('is idempotent -- calling it again returns the same profile', () => {
    const manager = newManager();
    const first = manager.ensureDefaultLocalProfile();
    const second = manager.ensureDefaultLocalProfile();

    expect(second.id).toBe(first.id);
    expect(manager.list()).toHaveLength(1);
  });
});

describe('create / list / switchProfile', () => {
  it('creates additional profiles without disturbing the active one', () => {
    const manager = newManager();
    const local = manager.ensureDefaultLocalProfile();
    const mock = manager.create({ name: 'Mock', config: { kind: 'mock-remote' } });

    expect(manager.list().map((profile) => profile.id)).toEqual([local.id, mock.id]);
    expect(manager.getActive().id).toBe(local.id);
  });

  it('switchProfile changes the active profile', () => {
    const manager = newManager();
    manager.ensureDefaultLocalProfile();
    const mock = manager.create({ name: 'Mock', config: { kind: 'mock-remote' } });

    manager.switchProfile(mock.id);
    expect(manager.getActive().id).toBe(mock.id);
  });

  it('throws switching to an unknown profile id', () => {
    const manager = newManager();
    manager.ensureDefaultLocalProfile();
    expect(() => manager.switchProfile('nope')).toThrow('Unknown profile');
  });
});

describe('delete', () => {
  it('refuses to delete the last local profile', () => {
    const manager = newManager();
    const local = manager.ensureDefaultLocalProfile();
    expect(() => manager.delete(local.id)).toThrow('Cannot delete the last local profile');
  });

  it('deletes a non-local profile', () => {
    const manager = newManager();
    manager.ensureDefaultLocalProfile();
    const mock = manager.create({ name: 'Mock', config: { kind: 'mock-remote' } });

    manager.delete(mock.id);
    expect(manager.list()).toHaveLength(1);
  });

  it('falls back the active profile when the active one is deleted', () => {
    const manager = newManager();
    const local = manager.ensureDefaultLocalProfile();
    const mock = manager.create({ name: 'Mock', config: { kind: 'mock-remote' } });
    manager.switchProfile(mock.id);

    manager.delete(mock.id);
    expect(manager.getActive().id).toBe(local.id);
  });
});

describe('persistence across instances', () => {
  it('reloads the manifest from disk in a new ProfileManager instance', () => {
    const first = newManager();
    const local = first.ensureDefaultLocalProfile();

    const second = newManager();
    expect(second.getActive().id).toBe(local.id);
    expect(second.list()).toHaveLength(1);
  });
});

describe('appendPatch / loadSnapshot / sync', () => {
  it('appendPatch + loadSnapshot round-trip on the active profile', async () => {
    const manager = newManager();
    manager.ensureDefaultLocalProfile();

    await manager.appendPatch('doc', Buffer.from('hello'));
    expect((await manager.loadSnapshot('doc'))?.toString()).toBe('hello');
  });

  it('sync() is a no-op for the local profile', async () => {
    const manager = newManager();
    manager.ensureDefaultLocalProfile();
    await expect(manager.sync()).resolves.toEqual([]);
  });

  it('sync() pushes/pulls through a mock-remote profile without duplicating the pushed patch', async () => {
    const manager = newManager();
    manager.ensureDefaultLocalProfile();
    const mock = manager.create({ name: 'Mock', config: { kind: 'mock-remote' } });
    manager.switchProfile(mock.id);

    await manager.appendPatch('doc', Buffer.from('hello'));
    await manager.sync();
    await manager.sync(); // idempotent -- must not throw on the unique remote_seq index

    expect((await manager.loadSnapshot('doc'))?.toString()).toBe('hello');
  });

  it('sync() returns the docKeys touched by newly pulled remote patches', async () => {
    const manager = newManager();
    manager.ensureDefaultLocalProfile();
    const mock = manager.create({ name: 'Mock', config: { kind: 'mock-remote' } });
    manager.switchProfile(mock.id);

    await manager.appendPatch('doc', Buffer.from('hello'));
    // Echoes back this device's own just-pushed patch (pull() reads from the
    // cursor before applyRemotePatches advances it) -- still correct: the
    // renderer's reload-on-change path is idempotent for already-known data.
    await expect(manager.sync()).resolves.toEqual(['doc']);
    // Nothing new to pull the second time.
    await expect(manager.sync()).resolves.toEqual([]);
  });
});

describe('checkRemoteStatus', () => {
  it('is a no-op ({ hasChanges: false }) for the local profile', async () => {
    const manager = newManager();
    manager.ensureDefaultLocalProfile();
    await expect(manager.checkRemoteStatus()).resolves.toEqual({
      hasChanges: false,
      latestSeq: 0,
      count: 0
    });
  });

  it('reflects a mock-remote push made by another device before any sync()', async () => {
    const manager = newManager();
    manager.ensureDefaultLocalProfile();
    const mock = manager.create({ name: 'Mock', config: { kind: 'mock-remote' } });
    manager.switchProfile(mock.id);

    // A second device sharing the same mock server pushes first.
    const other = newManager();
    const otherMock = other.create({
      name: 'Mock',
      config: {
        kind: 'mock-remote',
        mockServerDbFile: (mock as MockRemoteProfileDescriptor).mockServerDbFile
      }
    });
    other.switchProfile(otherMock.id);
    await other.appendPatch('doc', Buffer.from('from-other-device'));
    await other.sync();

    await expect(manager.checkRemoteStatus()).resolves.toEqual({
      hasChanges: true,
      latestSeq: 1,
      count: 1
    });
    await manager.sync();
    await expect(manager.checkRemoteStatus()).resolves.toEqual({
      hasChanges: false,
      latestSeq: 1,
      count: 0
    });
  });
});

describe('getUnpushedPatchCount', () => {
  it('counts patches appended on the active profile', async () => {
    const manager = newManager();
    manager.ensureDefaultLocalProfile();

    expect(await manager.getUnpushedPatchCount()).toBe(0);
    await manager.appendPatch('doc', Buffer.from('a'));
    await manager.appendPatch('doc', Buffer.from('b'));
    expect(await manager.getUnpushedPatchCount()).toBe(2);
  });

  it('drops to 0 once sync() pushes through a mock-remote profile', async () => {
    const manager = newManager();
    manager.ensureDefaultLocalProfile();
    const mock = manager.create({ name: 'Mock', config: { kind: 'mock-remote' } });
    manager.switchProfile(mock.id);

    await manager.appendPatch('doc', Buffer.from('hello'));
    expect(await manager.getUnpushedPatchCount()).toBe(1);

    await manager.sync();
    expect(await manager.getUnpushedPatchCount()).toBe(0);
  });
});

describe('compact', () => {
  it('is a no-op (beyond its internal sync()) for the local profile', async () => {
    const manager = newManager();
    manager.ensureDefaultLocalProfile();
    await expect(manager.compact()).resolves.toEqual([]);
  });

  it('is a no-op (beyond its internal sync()) for a mock-remote profile -- no compact support', async () => {
    const manager = newManager();
    manager.ensureDefaultLocalProfile();
    const mock = manager.create({ name: 'Mock', config: { kind: 'mock-remote' } });
    manager.switchProfile(mock.id);

    await manager.appendPatch('doc', Buffer.from('hello'));
    await manager.compact();
    // compact()'s internal sync() still pushed the pending patch, even though
    // nothing about compaction itself applies to mock-remote.
    expect(await manager.getUnpushedPatchCount()).toBe(0);
  });

  it('merges a doc with 2+ confirmed patches and calls the remote compact endpoint once with the merged upToSeq', async () => {
    const manager = newManager();
    manager.ensureDefaultLocalProfile();
    const remote = manager.create({ name: 'Remote', config: remoteConfig() });
    manager.switchProfile(remote.id);

    const [first, second] = makeSequentialPatches([1, 2]);
    await manager.appendPatch('doc', first);
    await manager.appendPatch('doc', second);

    let pushSeq = 0;
    let compactCalls = 0;
    let compactedUpToSeq: number | undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url.endsWith('/api/kv/patches') && init?.method === 'POST') {
          const body = JSON.parse(init.body as string) as { clientId: number }[];
          return jsonResponse(
            200,
            body.map((item) => ({ clientId: item.clientId, seq: ++pushSeq }))
          );
        }
        if (url.includes('/api/kv/patches?since=')) return jsonResponse(200, []);
        if (url.endsWith('/compact')) {
          compactCalls++;
          compactedUpToSeq = (JSON.parse(init?.body as string) as { upToSeq: number }).upToSeq;
          return jsonResponse(200, { ok: true });
        }
        throw new Error(`unexpected fetch to ${url}`);
      })
    );

    await manager.compact();

    expect(compactCalls).toBe(1);
    expect(compactedUpToSeq).toBe(2);
  });

  it('never calls compact for a doc with fewer than 2 confirmed patches', async () => {
    const manager = newManager();
    manager.ensureDefaultLocalProfile();
    const remote = manager.create({ name: 'Remote', config: remoteConfig() });
    manager.switchProfile(remote.id);

    await manager.appendPatch('doc', makeSequentialPatches([1])[0]);

    let compactCalls = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url.endsWith('/api/kv/patches') && init?.method === 'POST') {
          const body = JSON.parse(init.body as string) as { clientId: number }[];
          return jsonResponse(
            200,
            body.map((item, index) => ({ clientId: item.clientId, seq: index + 1 }))
          );
        }
        if (url.includes('/api/kv/patches?since=')) return jsonResponse(200, []);
        if (url.endsWith('/compact')) {
          compactCalls++;
          return jsonResponse(200, { ok: true });
        }
        throw new Error(`unexpected fetch to ${url}`);
      })
    );

    await manager.compact();
    expect(compactCalls).toBe(0);
  });
});
