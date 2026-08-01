import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { createProfileManager, type ProfileManager } from './profileManager';
import type { MockRemoteProfileDescriptor } from './types';

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
