import { DatabaseSync } from 'node:sqlite';
import { safeStorage } from 'electron';
import { mergeUpdates } from 'yjs';
import type {
  CompactionCandidate,
  OfflineStore,
  PendingPatch,
  ProfileId,
  PushAck,
  RemotePatch
} from './types';

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

  -- "Resume from baseline instead of replaying the whole patch log" -- see
  -- applyCompact()/loadSnapshot(). A row here means patches with
  -- remote_seq <= baseline_seq for that key have been folded in and deleted.
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

/**
 * A stored row stops being readable when the OS keyring's Safe Storage
 * password no longer matches the one that wrote it -- on Linux a regenerated
 * `Chromium Safe Storage` secret makes every existing v11 blob fail with "bad
 * decrypt". Those rows are gone for good, but one of them must not take its
 * whole doc down with it: readers return the readable subset so the doc still
 * loads (see usePersistStore, which would otherwise hang in `isLoading`
 * forever and freeze the UI at its defaults).
 *
 * Deliberately does not delete the bad rows -- a merely *locked* keyring fails
 * identically, and that case fixes itself once it unlocks. Pruning here would
 * turn a transient lock into permanent data loss.
 */
function tryDecrypt(blob: Uint8Array, context: string): Buffer | null {
  try {
    return decrypt(blob);
  } catch (err) {
    console.warn(
      `Skipping undecryptable row for "${context}" -- keyring secret likely changed:`,
      err instanceof Error ? err.message : err
    );
    return null;
  }
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
 * Not wrapped in its own transaction -- callers run this inside whichever
 * transaction they already hold (applyRemotePatches' existing one, or
 * applyCompact()'s own). Upserting `sync_snapshot` is monotonic (a lower
 * upToSeq than what's already stored there is a no-op on the snapshot row
 * itself), but the DELETE below always runs regardless -- it's an idempotent
 * subset-delete either way, since a doc's local patches with remote_seq below
 * whatever the current baseline_seq is are always redundant.
 */
function applyCompactStatements(
  db: DatabaseSync,
  key: string,
  upToSeq: number,
  baseline: Buffer
): void {
  db.prepare(
    `INSERT INTO sync_snapshot (store_key, baseline, baseline_seq, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(store_key) DO UPDATE SET
       baseline = excluded.baseline, baseline_seq = excluded.baseline_seq, updated_at = excluded.updated_at
     WHERE excluded.baseline_seq > sync_snapshot.baseline_seq`
  ).run(key, encrypt(baseline), upToSeq, Date.now());

  db.prepare(
    'DELETE FROM patches WHERE store_key = ? AND remote_seq IS NOT NULL AND remote_seq <= ?'
  ).run(key, upToSeq);
}

// Past this many unpushed patches piled up for one key, loadSnapshot's
// mergeUpdates on every load starts doing repeat work over rows that are
// still just sitting there unsynced -- fold them down to one row instead.
const UNPUSHED_COMPACT_THRESHOLD = 5;

/**
 * Replaces `rows` (all unpushed, i.e. remote_seq IS NULL) with a single row
 * holding their merged content. Purely local bookkeeping -- unlike
 * applyCompactStatements, there's no server-side baseline to agree on since
 * these patches were never pushed, so this never touches sync_snapshot and
 * doesn't need a SyncProvider round trip. The merged row stays unpushed
 * (remote_seq NULL), so it's still picked up by listUnpushedPatches/push()
 * same as before, just as one row instead of many.
 */
function compactUnpushedStatements(
  db: DatabaseSync,
  key: string,
  rows: { id: number; decrypted: Buffer }[]
): void {
  const merged = Buffer.from(mergeUpdates(rows.map((row) => row.decrypted)));
  const del = db.prepare('DELETE FROM patches WHERE id = ?');
  for (const row of rows) del.run(row.id);
  db.prepare('INSERT INTO patches (store_key, patch, created_at) VALUES (?, ?, ?)').run(
    key,
    encrypt(merged),
    Date.now()
  );
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
      const database = requireDb();
      const snapshot = database
        .prepare('SELECT baseline FROM sync_snapshot WHERE store_key = ?')
        .get(key) as { baseline: Uint8Array } | undefined;
      // After a compact, `patches` only ever holds rows for `key` above the
      // snapshot's baseline_seq (applyCompactStatements deletes the rest) --
      // so snapshot + remaining patches always covers the full history.
      const rows = database
        .prepare('SELECT id, patch, remote_seq FROM patches WHERE store_key = ? ORDER BY id')
        .all(key) as { id: number; patch: Uint8Array; remote_seq: number | null }[];
      if (!snapshot && rows.length === 0) return null;

      const readable = rows.flatMap((row) => {
        const plain = tryDecrypt(row.patch, key);
        return plain ? [{ ...row, decrypted: plain }] : [];
      });
      const baseline = snapshot ? tryDecrypt(snapshot.baseline, `${key} baseline`) : null;

      const decrypted = readable.map((row) => row.decrypted);
      if (baseline) decrypted.unshift(baseline);
      // Everything for this key was unreadable -- same as having no history.
      if (decrypted.length === 0) return null;
      const merged = decrypted.length === 1 ? decrypted[0] : Buffer.from(mergeUpdates(decrypted));

      const unpushed = readable.filter((row) => row.remote_seq === null);
      if (unpushed.length > UNPUSHED_COMPACT_THRESHOLD) {
        database.exec('BEGIN');
        try {
          compactUnpushedStatements(database, key, unpushed);
          database.exec('COMMIT');
        } catch (err) {
          database.exec('ROLLBACK');
          throw err;
        }
      }

      return merged;
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
      return rows.flatMap((row) => {
        const patch = tryDecrypt(row.patch, row.store_key);
        if (!patch) return [];
        return [
          {
            localId: row.id,
            docKey: row.store_key,
            patch,
            createdAt: row.created_at
          }
        ];
      });
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
          if (patch.isBaseline) {
            applyCompactStatements(database, patch.docKey, patch.remoteSeq, patch.patch);
          } else {
            insert.run(patch.docKey, encrypt(patch.patch), Date.now(), patch.remoteSeq);
          }
          if (patch.remoteSeq > maxSeq) maxSeq = patch.remoteSeq;
        }
        writeCursor(database, maxSeq);
        database.exec('COMMIT');
      } catch (err) {
        database.exec('ROLLBACK');
        throw err;
      }
    },

    listCompactionCandidates(): CompactionCandidate[] {
      const database = requireDb();
      const groups = database
        .prepare(
          `SELECT store_key, MAX(remote_seq) AS up_to_seq
           FROM patches
           WHERE remote_seq IS NOT NULL
           GROUP BY store_key
           HAVING COUNT(*) >= 2`
        )
        .all() as { store_key: string; up_to_seq: number }[];

      return groups.flatMap(({ store_key, up_to_seq }) => {
        const rows = database
          .prepare(
            'SELECT patch FROM patches WHERE store_key = ? AND remote_seq IS NOT NULL ORDER BY id'
          )
          .all(store_key) as { patch: Uint8Array }[];
        const decrypted = rows.map((row) => tryDecrypt(row.patch, store_key));
        // A baseline is only safe to publish if it covers every row it claims
        // to -- applyCompactStatements deletes patches up to upToSeq, so a
        // baseline built from a partial read would drop readable history too.
        if (decrypted.some((patch) => patch === null)) return [];
        return [
          {
            docKey: store_key,
            baseline: Buffer.from(mergeUpdates(decrypted as Buffer[])),
            upToSeq: up_to_seq
          }
        ];
      });
    },

    applyCompact(key: string, upToSeq: number, baseline: Buffer): void {
      const database = requireDb();
      database.exec('BEGIN');
      try {
        applyCompactStatements(database, key, upToSeq, baseline);
        database.exec('COMMIT');
      } catch (err) {
        database.exec('ROLLBACK');
        throw err;
      }
    }
  };
}
