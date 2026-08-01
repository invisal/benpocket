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
}
