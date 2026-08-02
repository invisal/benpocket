import { DatabaseSync } from 'node:sqlite';
import type {
  MockRemoteProfileDescriptor,
  PendingPatch,
  PushAck,
  RemotePatch,
  RemoteSyncStatus,
  SyncProvider
} from './types';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS patches (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  doc_key TEXT NOT NULL,
  patch BLOB NOT NULL
);
`;

/**
 * Stands in for a real remote server -- reads/writes a second local sqlite
 * file instead of doing HTTP. Deliberately unencrypted so its contents are
 * directly inspectable in tests. One fixed schema created via
 * CREATE TABLE IF NOT EXISTS, no versioned migrations: this is a test-only
 * artifact that won't evolve independently. Two MockSyncProviders pointed at
 * the same mockServerDbFile simulate "two devices, one account".
 */
export function createMockSyncProvider(descriptor: MockRemoteProfileDescriptor): SyncProvider {
  const db = new DatabaseSync(descriptor.mockServerDbFile);
  db.exec(SCHEMA);

  return {
    async push(patches: PendingPatch[]): Promise<PushAck[]> {
      const insert = db.prepare('INSERT INTO patches (doc_key, patch) VALUES (?, ?)');
      const lastSeq = db.prepare('SELECT last_insert_rowid() AS seq');
      return patches.map((patch) => {
        insert.run(patch.docKey, patch.patch);
        const { seq } = lastSeq.get() as { seq: number };
        return { localId: patch.localId, remoteSeq: seq };
      });
    },

    async pull(sinceSeq: number): Promise<RemotePatch[]> {
      const rows = db
        .prepare('SELECT seq, doc_key, patch FROM patches WHERE seq > ? ORDER BY seq')
        .all(sinceSeq) as { seq: number; doc_key: string; patch: Uint8Array }[];
      return rows.map((row) => ({
        docKey: row.doc_key,
        remoteSeq: row.seq,
        patch: Buffer.from(row.patch)
      }));
    },

    async status(sinceSeq: number): Promise<RemoteSyncStatus> {
      const row = db
        .prepare('SELECT COUNT(*) AS count, MAX(seq) AS latestSeq FROM patches WHERE seq > ?')
        .get(sinceSeq) as { count: number; latestSeq: number | null };
      return { hasChanges: row.count > 0, latestSeq: row.latestSeq ?? sinceSeq, count: row.count };
    },

    close(): void {
      db.close();
    }
  };
}
