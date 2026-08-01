import { randomUUID } from 'crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { createOfflineStore } from './offlineStore';
import { createSyncProvider } from './syncProvider';
import type {
  CreateProfileOptions,
  OfflineStore,
  ProfileConfig,
  ProfileDescriptor,
  ProfileId,
  ProfileManifest,
  SyncProvider
} from './types';

export interface ProfileManager {
  list(): ProfileDescriptor[];
  getActive(): ProfileDescriptor;
  switchProfile(profileId: ProfileId): void;
  create(options: CreateProfileOptions): ProfileDescriptor;
  delete(profileId: ProfileId): void;

  /** Idempotent; guarantees exactly one 'local' profile exists. Called at app startup. */
  ensureDefaultLocalProfile(): ProfileDescriptor;

  // Data access on the active profile -- thin delegation to its OfflineStore.
  loadSnapshot(key: string): Promise<Buffer | null>;
  appendPatch(key: string, patch: Buffer): Promise<void>;

  /** Count of the active profile's patches not yet pushed to its SyncProvider -- powers the sync status indicator. */
  getUnpushedPatchCount(): Promise<number>;

  // Mediates the active profile's OfflineStore and SyncProvider -- no-op for
  // 'local' since LocalSyncProvider.push()/pull() both resolve to []. Returns
  // the unique docKeys touched by newly pulled remote patches, so callers can
  // tell live consumers (usePersistStore) what to reload.
  sync(): Promise<string[]>;

  /** Closes every cached profile's OfflineStore -- call on app quit (and between tests). */
  closeAll(): void;
}

interface ProfileSession {
  store: OfflineStore;
  provider: SyncProvider;
}

function manifestPath(profilesDir: string): string {
  return join(profilesDir, 'profiles.json');
}

function readManifest(profilesDir: string): ProfileManifest | null {
  try {
    return JSON.parse(readFileSync(manifestPath(profilesDir), 'utf-8')) as ProfileManifest;
  } catch {
    // File doesn't exist yet, or is corrupt -- start fresh rather than crash.
    return null;
  }
}

function writeManifest(profilesDir: string, manifest: ProfileManifest): void {
  mkdirSync(profilesDir, { recursive: true });
  writeFileSync(manifestPath(profilesDir), JSON.stringify(manifest, null, 2), 'utf-8');
}

function buildDescriptor(
  id: ProfileId,
  name: string,
  dbFile: string,
  config: ProfileConfig,
  profilesDir: string
): ProfileDescriptor {
  const now = Date.now();
  const common = { id, name, createdAt: now, updatedAt: now, dbFile };
  switch (config.kind) {
    case 'local':
      return { ...common, kind: 'local' };
    case 'remote':
      return {
        ...common,
        kind: 'remote',
        apiBaseUrl: config.apiBaseUrl,
        provider: config.provider
      };
    case 'mock-remote':
      return {
        ...common,
        kind: 'mock-remote',
        mockServerDbFile:
          config.mockServerDbFile ?? join(profilesDir, `mock-server-${randomUUID()}.db`)
      };
  }
}

/**
 * `profilesDir` is where profiles.json and every profile's own sqlite file
 * live (userData/ in production, a temp dir in tests) -- passed in rather
 * than resolved via electron's app.getPath internally, so this stays
 * testable without mocking electron.
 */
export function createProfileManager(profilesDir: string): ProfileManager {
  let manifest = readManifest(profilesDir);
  const sessions = new Map<ProfileId, ProfileSession>();

  function persist(): void {
    if (manifest) writeManifest(profilesDir, manifest);
  }

  function findDescriptor(profileId: ProfileId): ProfileDescriptor {
    const found = manifest?.profiles.find((profile) => profile.id === profileId);
    if (!found) throw new Error(`Unknown profile: ${profileId}`);
    return found;
  }

  function openSession(
    descriptor: ProfileDescriptor,
    initialConfig?: ProfileConfig
  ): ProfileSession {
    const store = createOfflineStore(descriptor.id, join(profilesDir, descriptor.dbFile));
    // node:sqlite has no async I/O -- open() completes synchronously before
    // this call returns, so it's safe to use without awaiting here.
    void store.open();
    const provider = createSyncProvider(descriptor, store, initialConfig);
    const session: ProfileSession = { store, provider };
    sessions.set(descriptor.id, session);
    return session;
  }

  function getSession(profileId: ProfileId): ProfileSession {
    return sessions.get(profileId) ?? openSession(findDescriptor(profileId));
  }

  function getActiveSession(): ProfileSession {
    return getSession(manager.getActive().id);
  }

  const manager: ProfileManager = {
    list(): ProfileDescriptor[] {
      return manifest?.profiles ?? [];
    },

    getActive(): ProfileDescriptor {
      if (!manifest)
        throw new Error('No profiles exist yet -- call ensureDefaultLocalProfile() first.');
      return findDescriptor(manifest.activeProfileId);
    },

    switchProfile(profileId: ProfileId): void {
      findDescriptor(profileId); // throws if unknown
      manifest = { ...manifest!, activeProfileId: profileId };
      persist();
    },

    create(options: CreateProfileOptions): ProfileDescriptor {
      const id = randomUUID();
      const descriptor = buildDescriptor(id, options.name, `${id}.db`, options.config, profilesDir);

      manifest = manifest
        ? { ...manifest, profiles: [...manifest.profiles, descriptor] }
        : { version: 1, activeProfileId: descriptor.id, profiles: [descriptor] };
      persist();

      // Opens right away (rather than lazily on next access) so the
      // SyncProvider gets initialConfig this one time, letting it persist
      // whatever it privately needs (DEK, refreshToken, token) into the
      // profile's own OfflineStore settings KV.
      openSession(descriptor, options.config);

      return descriptor;
    },

    delete(profileId: ProfileId): void {
      const target = findDescriptor(profileId);
      const otherLocalExists = manifest!.profiles.some(
        (profile) => profile.id !== profileId && profile.kind === 'local'
      );
      if (target.kind === 'local' && !otherLocalExists) {
        throw new Error('Cannot delete the last local profile.');
      }

      const session = sessions.get(profileId);
      session?.store.close();
      session?.provider.close();
      sessions.delete(profileId);

      const remaining = manifest!.profiles.filter((profile) => profile.id !== profileId);
      const activeProfileId =
        manifest!.activeProfileId === profileId ? remaining[0].id : manifest!.activeProfileId;
      manifest = { ...manifest!, profiles: remaining, activeProfileId };
      persist();
    },

    ensureDefaultLocalProfile(): ProfileDescriptor {
      const existing = manifest?.profiles.find((profile) => profile.kind === 'local');
      return existing ?? manager.create({ name: 'Personal', config: { kind: 'local' } });
    },

    async loadSnapshot(key: string): Promise<Buffer | null> {
      return getActiveSession().store.loadSnapshot(key);
    },

    async appendPatch(key: string, patch: Buffer): Promise<void> {
      return getActiveSession().store.appendPatch(key, patch);
    },

    async getUnpushedPatchCount(): Promise<number> {
      return getActiveSession().store.listUnpushedPatches().length;
    },

    async sync(): Promise<string[]> {
      const { store, provider } = getActiveSession();
      store.markPushed(await provider.push(store.listUnpushedPatches()));
      const pulled = await provider.pull(store.getSyncCursor());
      store.applyRemotePatches(pulled);
      return [...new Set(pulled.map((patch) => patch.docKey))];
    },

    closeAll(): void {
      for (const session of sessions.values()) {
        session.store.close();
        session.provider.close();
      }
      sessions.clear();
    }
  };

  return manager;
}
