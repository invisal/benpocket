export type ProfileId = string; // crypto.randomUUID(), same as workspaces.ts's Workspace.id

export type ProfileKind = 'local' | 'remote' | 'mock-remote';

export interface ProfileManifest {
  version: 1;
  activeProfileId: ProfileId;
  profiles: ProfileDescriptor[];
}

interface ProfileDescriptorCommon {
  id: ProfileId;
  name: string;
  createdAt: number;
  updatedAt: number;
  /** Filename under userData/profiles/, e.g. `${id}.db` -- resolved to an absolute path by ProfileManager, never an absolute path itself. */
  dbFile: string;
}

export type ProfileDescriptor =
  LocalProfileDescriptor | RemoteProfileDescriptor | MockRemoteProfileDescriptor;

export interface LocalProfileDescriptor extends ProfileDescriptorCommon {
  kind: 'local';
}

export interface RemoteProfileDescriptor extends ProfileDescriptorCommon {
  kind: 'remote';
  apiBaseUrl: string; // was the hardcoded API_BASE_URL in auth/githubAuth.ts -- now per-profile
  provider: 'github'; // discriminant left open for future providers
}

export interface MockRemoteProfileDescriptor extends ProfileDescriptorCommon {
  kind: 'mock-remote';
  /** Absolute path to the second local sqlite file standing in for "the server" -- see mockSyncProvider.ts. */
  mockServerDbFile: string;
}

// The OAuth login (PKCE) and master-password setup/unlock (to obtain the DEK)
// both happen in the renderer, driven by IPC, before create() is ever called.
// ProfileConfig for 'remote' just carries the results.
export type ProfileConfig =
  | { kind: 'local' }
  | {
      kind: 'remote';
      apiBaseUrl: string;
      provider: 'github';
      refreshToken: string; // from the renderer-driven PKCE flow (auth/githubAuth.ts)
      token: string; // short-lived access token from that same flow
      dek: Buffer; // already unwrapped/generated via the renderer's master-password step
    }
  | {
      kind: 'mock-remote';
      /** Path to an existing mockServerDbFile to share with another mock-remote
       * profile, simulating "two devices, one account". Omit to have a fresh
       * one generated for this profile alone. No dek -- MockSyncProvider
       * doesn't encrypt at all. */
      mockServerDbFile?: string;
    };

export interface CreateProfileOptions {
  name: string;
  config: ProfileConfig;
}

export interface PendingPatch {
  localId: number; // OfflineStore's own row id -- echoed back in PushAck to mark as pushed
  docKey: string;
  patch: Buffer; // plaintext -- the provider encrypts internally before it leaves this device, if it encrypts at all
  createdAt: number;
}

export interface PushAck {
  localId: number; // correlates back to PendingPatch.localId
  remoteSeq: number; // server- (or mock-server-) assigned sequence number
}

export interface RemotePatch {
  docKey: string;
  remoteSeq: number;
  patch: Buffer; // plaintext -- the provider has already decrypted this before returning it
  /** True when this entry is a doc's compacted baseline rather than a granular patch -- see OfflineStore.applyCompact. */
  isBaseline?: boolean;
}

export interface CompactionCandidate {
  docKey: string;
  baseline: Buffer; // plaintext, merged via yjs mergeUpdates over this device's already-confirmed patches
  upToSeq: number; // MAX(remote_seq) among the patches folded into baseline
}

export interface RemoteSyncStatus {
  hasChanges: boolean; // whether the remote has any patch past sinceSeq
  latestSeq: number; // the remote's current max seq -- sinceSeq itself if there's nothing newer
  count: number; // how many patches the remote is ahead by -- 0 when !hasChanges
}

export interface SyncProvider {
  push(patches: PendingPatch[]): Promise<PushAck[]>;
  pull(sinceSeq: number): Promise<RemotePatch[]>;

  /** Cheap precheck: is there anything newer than sinceSeq on the remote, without downloading/decrypting it. */
  status(sinceSeq: number): Promise<RemoteSyncStatus>;

  /** Optional -- only RemoteSyncProvider implements this (local/mock-remote
   * have no server-side patch log to compact). Submits a merged baseline for
   * one doc, covering ops up to upToSeq. `noop: true` means another device
   * already compacted at least as far -- not an error, the caller still
   * trims its own local copy either way (see ProfileManager.compact()). */
  compact?(
    docKey: string,
    upToSeq: number,
    baseline: Buffer
  ): Promise<{ ok: boolean; noop?: boolean }>;

  /** Closes any resource this provider opened (e.g. MockSyncProvider's own sqlite connection). No-op if it opened nothing. */
  close(): void;
}

export interface OfflineStore {
  readonly profileId: ProfileId;

  /** Opens (creates if missing) this profile's sqlite file and runs any
   * pending migrations -- safe to call every time, not just the first. */
  open(): Promise<void>;
  close(): void;

  // Encrypts internally via safeStorage before writing; decrypts on read.
  appendPatch(key: string, patch: Buffer): Promise<void>;

  /** Merges `key`'s baseline (if any) + every patch into one plaintext
   * snapshot. Side effect: when more than 5 unpushed (remote_seq IS NULL)
   * patches exist for `key`, they're folded into a single unpushed row first
   * -- purely local, no SyncProvider round trip, since nothing server-side
   * needs to agree on it yet (contrast with applyCompact, which only ever
   * touches remote_seq-confirmed rows because other devices need to learn
   * about that baseline too). */
  loadSnapshot(key: string): Promise<Buffer | null>;

  // Generic, safeStorage-encrypted per-value KV. OfflineStore doesn't know or
  // care what's stored here; it's how each SyncProvider persists its own
  // private state (DEK, refreshToken, token) across app restarts.
  getSetting(key: string): string | undefined;
  setSetting(key: string, value: string): void;

  // Sync-support, called only by ProfileManager.sync() to mediate with a
  // SyncProvider. Patches here are plaintext; SyncProvider handles its own
  // encryption on the way out/in. No allowlist/scoping: every patch in this
  // profile gets synced, full stop.
  listUnpushedPatches(): PendingPatch[];
  markPushed(acks: PushAck[]): void;
  getSyncCursor(): number;
  applyRemotePatches(patches: RemotePatch[]): void; // also advances the cursor

  /** Doc keys with >=2 remote_seq-confirmed patches, each group merged into
   * one plaintext baseline (yjs mergeUpdates) plus the max remote_seq folded
   * into it. Never includes unpushed (remote_seq IS NULL) patches -- those
   * don't exist server-side under any seq yet. Input for SyncProvider.compact(). */
  listCompactionCandidates(): CompactionCandidate[];

  /** Replaces local knowledge of `key` up to `upToSeq` with a single baseline:
   * upserts `sync_snapshot` (monotonic -- a lower upToSeq than what's already
   * stored there is a no-op) and deletes local patches for `key` with
   * `remote_seq <= upToSeq` (never touches unpushed remote_seq IS NULL rows).
   * Called both after this device's own remote compact (regardless of noop)
   * and when applyRemotePatches receives a pulled baseline entry -- always
   * safe because remote_seq-confirmed patches are already durable
   * server-side one way or another. */
  applyCompact(key: string, upToSeq: number, baseline: Buffer): void;
}
