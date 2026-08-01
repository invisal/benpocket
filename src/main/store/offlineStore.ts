import { DatabaseSync } from 'node:sqlite';
import { safeStorage } from 'electron';
import { mergeUpdates } from 'yjs';
import type { OfflineStore, PendingPatch, ProfileId, PushAck, RemotePatch } from './types';

// Single, from-scratch schema -- this is a new store, not an evolution of
// today's singleton store.db, so there's nothing to migrate from. No
// key_domain column (unlike today's patches table): there's no DEK inside
// OfflineStore at all, every row is protected the same way, by safeStorage.
const MIGRATIONS: string[] = [
  `
  CREATE TABLE patches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    store_key TEXT NOT NULL,
    patch BLOB NOT NULL,
    created_at INTEGER NOT NULL,
    remote_seq INTEGER
  );
  CREATE INDEX idx_patches_store_key ON patches (store_key);
  CREATE UNIQUE INDEX idx_patches_remote_seq ON patches (remote_seq) WHERE remote_seq IS NOT NULL;

  CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value BLOB NOT NULL
  );

  CREATE TABLE sync_cursor (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    last_synced_seq INTEGER NOT NULL DEFAULT 0
  );

  -- No reader/writer yet -- a "resume from baseline instead of replaying the
  -- whole patch log" fast path is a future addition, not needed for this pass.
  CREATE TABLE sync_snapshot (
    store_key TEXT PRIMARY KEY,
    baseline BLOB,
    baseline_seq INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL
  );
  `
];

function runMigrations(db: DatabaseSync): void {
  const { user_version: currentVersion } = db.prepare('PRAGMA user_version').get() as {
    user_version: number;
  };
  for (let version = currentVersion; version < MIGRATIONS.length; version++) {
    db.exec('BEGIN');
    try {
      db.exec(MIGRATIONS[version]);
      db.exec(`PRAGMA user_version = ${version + 1}`);
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  }
}

function encrypt(value: Buffer): Buffer {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('OS-level credential encryption is not available on this machine.');
  }
  return safeStorage.encryptString(value.toString('base64'));
}

function decrypt(blob: Uint8Array): Buffer {
  return Buffer.from(safeStorage.decryptString(Buffer.from(blob)), 'base64');
}

function readCursor(db: DatabaseSync): number {
  const row = db.prepare('SELECT last_synced_seq FROM sync_cursor WHERE id = 1').get() as
    { last_synced_seq: number } | undefined;
  return row?.last_synced_seq ?? 0;
}

function writeCursor(db: DatabaseSync, seq: number): void {
  db.prepare(
    `INSERT INTO sync_cursor (id, last_synced_seq) VALUES (1, ?)
     ON CONFLICT(id) DO UPDATE SET last_synced_seq = excluded.last_synced_seq`
  ).run(seq);
}

/**
 * `dbPath` is an already-resolved absolute path (or `:memory:`) -- resolving
 * userData/profiles/<id>.db is ProfileManager's job, not this one's, so this
 * stays testable without mocking electron's `app`.
 */
export function createOfflineStore(profileId: ProfileId, dbPath: string): OfflineStore {
  let db: DatabaseSync | null = null;

  function requireDb(): DatabaseSync {
    if (!db) throw new Error('OfflineStore used before open()');
    return db;
  }

  return {
    profileId,

    // node:sqlite has no async API -- this returns a Promise purely for
    // interface consistency with appendPatch/loadSnapshot, but the actual
    // work below is synchronous and complete before this function returns.
    async open(): Promise<void> {
      if (db) return;
      db = new DatabaseSync(dbPath);
      runMigrations(db);
    },

    close(): void {
      db?.close();
      db = null;
    },

    async appendPatch(key: string, patch: Buffer): Promise<void> {
      requireDb()
        .prepare('INSERT INTO patches (store_key, patch, created_at) VALUES (?, ?, ?)')
        .run(key, encrypt(patch), Date.now());
    },

    async loadSnapshot(key: string): Promise<Buffer | null> {
      const rows = requireDb()
        .prepare('SELECT patch FROM patches WHERE store_key = ? ORDER BY id')
        .all(key) as { patch: Uint8Array }[];
      if (rows.length === 0) return null;
      const decrypted = rows.map((row) => decrypt(row.patch));
      return decrypted.length === 1 ? decrypted[0] : Buffer.from(mergeUpdates(decrypted));
    },

    getSetting(key: string): string | undefined {
      const row = requireDb().prepare('SELECT value FROM settings WHERE key = ?').get(key) as
        { value: Uint8Array } | undefined;
      if (!row) return undefined;
      return safeStorage.decryptString(Buffer.from(row.value));
    },

    setSetting(key: string, value: string): void {
      if (!safeStorage.isEncryptionAvailable()) {
        throw new Error('OS-level credential encryption is not available on this machine.');
      }
      requireDb()
        .prepare(
          'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
        )
        .run(key, safeStorage.encryptString(value));
    },

    listUnpushedPatches(): PendingPatch[] {
      const rows = requireDb()
        .prepare('SELECT id, store_key, patch, created_at FROM patches WHERE remote_seq IS NULL')
        .all() as { id: number; store_key: string; patch: Uint8Array; created_at: number }[];
      return rows.map((row) => ({
        localId: row.id,
        docKey: row.store_key,
        patch: decrypt(row.patch),
        createdAt: row.created_at
      }));
    },

    markPushed(acks: PushAck[]): void {
      const database = requireDb();
      const stmt = database.prepare('UPDATE patches SET remote_seq = ? WHERE id = ?');
      for (const ack of acks) {
        stmt.run(ack.remoteSeq, ack.localId);
      }
    },

    getSyncCursor(): number {
      return readCursor(requireDb());
    },

    applyRemotePatches(patches: RemotePatch[]): void {
      if (patches.length === 0) return;
      const database = requireDb();
      // INSERT OR IGNORE: a pulled patch may be an echo of one this device
      // just pushed (same remote_seq already present from markPushed) --
      // safe to skip since the content's already here.
      const insert = database.prepare(
        'INSERT OR IGNORE INTO patches (store_key, patch, created_at, remote_seq) VALUES (?, ?, ?, ?)'
      );
      database.exec('BEGIN');
      try {
        let maxSeq = readCursor(database);
        for (const patch of patches) {
          insert.run(patch.docKey, encrypt(patch.patch), Date.now(), patch.remoteSeq);
          if (patch.remoteSeq > maxSeq) maxSeq = patch.remoteSeq;
        }
        writeCursor(database, maxSeq);
        database.exec('COMMIT');
      } catch (err) {
        database.exec('ROLLBACK');
        throw err;
      }
    }
  };
}
