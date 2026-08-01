import type {
  OfflineStore,
  PendingPatch,
  ProfileConfig,
  PushAck,
  RemotePatch,
  RemoteProfileDescriptor,
  RemoteSyncStatus,
  SyncProvider
} from './types';
import { createAuthFetch, type AuthTokens } from './remoteAuthClient';
import { decryptPatch, encryptPatch } from './remoteCrypto';

const SETTING_ACCESS_TOKEN = 'remoteSync.accessToken';
const SETTING_REFRESH_TOKEN = 'remoteSync.refreshToken';
const SETTING_DEK = 'remoteSync.dek';

type RemoteProfileConfig = Extract<ProfileConfig, { kind: 'remote' }>;

function requireSetting(store: OfflineStore, key: string): string {
  const value = store.getSetting(key);
  if (value === undefined) {
    throw new Error(
      `RemoteSyncProvider: missing persisted setting "${key}" -- profile may be corrupted; re-create this profile.`
    );
  }
  return value;
}

/**
 * `initialConfig` (present only the first time a profile is created, per
 * ProfileManager.create()) carries the already-obtained refreshToken/token/dek
 * from the GitHub login + master-password flow (see src/main/store/PLAN3.md)
 * -- this provider's job is to persist those into `store`'s settings KV,
 * reload them on every later open, and use them to authenticate the actual
 * doc-sync calls against `descriptor.apiBaseUrl`.
 */
export function createRemoteSyncProvider(
  descriptor: RemoteProfileDescriptor,
  store: OfflineStore,
  initialConfig?: RemoteProfileConfig
): SyncProvider {
  let initialTokens: AuthTokens;
  let dek: Buffer;

  if (initialConfig) {
    initialTokens = { accessToken: initialConfig.token, refreshToken: initialConfig.refreshToken };
    // initialConfig arrives from the renderer over IPC, which structured-clones
    // Buffer down to a plain Uint8Array -- Uint8Array#toString() ignores the
    // 'base64' argument (it's Array.prototype.toString, comma-joined decimal
    // bytes), so without this coercion the persisted setting below is garbage
    // and every later reload decrypts with a wrong-length key.
    dek = Buffer.from(initialConfig.dek);
    store.setSetting(SETTING_ACCESS_TOKEN, initialTokens.accessToken);
    store.setSetting(SETTING_REFRESH_TOKEN, initialTokens.refreshToken);
    store.setSetting(SETTING_DEK, dek.toString('base64'));
  } else {
    initialTokens = {
      accessToken: requireSetting(store, SETTING_ACCESS_TOKEN),
      refreshToken: requireSetting(store, SETTING_REFRESH_TOKEN)
    };
    dek = Buffer.from(requireSetting(store, SETTING_DEK), 'base64');
  }

  // ProfileManager.sync() calls push() then pull() sequentially, never
  // concurrently, on one provider instance -- a single mutable token pair
  // inside authFetch (persisted here via onTokensRefreshed) is sufficient.
  const authFetch = createAuthFetch({
    apiBaseUrl: descriptor.apiBaseUrl,
    tokens: initialTokens,
    onTokensRefreshed: (refreshed) => {
      store.setSetting(SETTING_ACCESS_TOKEN, refreshed.accessToken);
      store.setSetting(SETTING_REFRESH_TOKEN, refreshed.refreshToken);
    }
  });

  return {
    async push(patches: PendingPatch[]): Promise<PushAck[]> {
      if (patches.length === 0) return [];

      const body = patches.map((patch) => ({
        clientId: patch.localId,
        docKey: patch.docKey,
        patch: encryptPatch(dek, patch.docKey, patch.patch)
      }));

      const response = await authFetch('/api/kv/patches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Push failed: ${response.status} ${text.slice(0, 500)}`);
      }

      const acks = (await response.json()) as { clientId: number; seq: number }[];
      return acks.map((ack) => ({ localId: ack.clientId, remoteSeq: ack.seq }));
    },

    async pull(sinceSeq: number): Promise<RemotePatch[]> {
      const response = await authFetch(`/api/kv/patches?since=${sinceSeq}`);

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Pull failed: ${response.status} ${text.slice(0, 500)}`);
      }

      const rows = (await response.json()) as {
        docKey: string;
        seq: number;
        patch: string;
        isBaseline?: boolean;
      }[];
      return rows.map((row) => ({
        docKey: row.docKey,
        remoteSeq: row.seq,
        patch: decryptPatch(dek, row.docKey, row.patch),
        isBaseline: row.isBaseline
      }));
    },

    async compact(
      docKey: string,
      upToSeq: number,
      baseline: Buffer
    ): Promise<{ ok: boolean; noop?: boolean }> {
      const response = await authFetch(`/api/kv/${encodeURIComponent(docKey)}/compact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ upToSeq, baseline: encryptPatch(dek, docKey, baseline) })
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Compact failed: ${response.status} ${text.slice(0, 500)}`);
      }

      return (await response.json()) as { ok: boolean; noop?: boolean };
    },

    async status(sinceSeq: number): Promise<RemoteSyncStatus> {
      const response = await authFetch(`/api/kv/status?since=${sinceSeq}`);

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Status check failed: ${response.status} ${text.slice(0, 500)}`);
      }

      const body = (await response.json()) as {
        hasChanges: boolean;
        latestSeq: number;
        count: number;
      };
      return { hasChanges: body.hasChanges, latestSeq: body.latestSeq, count: body.count };
    },

    // fetch holds no persistent handle to release, and ProfileManager.sync()
    // always awaits push/pull to completion before close() could run on the
    // same session -- matches LocalSyncProvider's no-op.
    close: () => {}
  };
}
