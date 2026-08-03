export type ProfileId = string;

interface ProfileDescriptorCommon {
  id: ProfileId;
  name: string;
  createdAt: number;
  updatedAt: number;
}

export interface LocalProfileDescriptor extends ProfileDescriptorCommon {
  kind: 'local';
}

export interface RemoteProfileDescriptor extends ProfileDescriptorCommon {
  kind: 'remote';
  apiBaseUrl: string;
  provider: 'github';
}

export interface MockRemoteProfileDescriptor extends ProfileDescriptorCommon {
  kind: 'mock-remote';
  /** Absolute path to the sqlite file standing in for "the server". */
  mockServerDbFile: string;
}

export type ProfileDescriptor =
  LocalProfileDescriptor | RemoteProfileDescriptor | MockRemoteProfileDescriptor;

export interface SwitchProfileResult {
  ok: boolean;
  error?: string;
}

export type SyncResult = { ok: true } | { ok: false; error: string };

export type SyncStatusResult =
  | { ok: true; hasChanges: boolean; latestSeq: number; count: number }
  | { ok: false; error: string };

export type ProfileConfig =
  | { kind: 'local' }
  | {
      kind: 'remote';
      apiBaseUrl: string;
      provider: 'github';
      refreshToken: string; // from the GitHub PKCE login flow, see src/preload/auth/api.ts
      token: string; // short-lived access token from that same flow
      // Uint8Array, not Buffer -- the renderer has no Node Buffer global.
      // window.auth.setupMasterPassword/unlockMasterPassword already return
      // Uint8Array for the same reason; main-side ProfileManager.create()
      // converts via Buffer.from() once RemoteSyncProvider is implemented.
      dek: Uint8Array;
    }
  | {
      kind: 'mock-remote';
      /** Path to an existing mockServerDbFile to share with another
       * mock-remote profile, simulating "two devices, one account". Omit to
       * have a fresh one generated for this profile alone. */
      mockServerDbFile?: string;
    };

export interface CreateProfileOptions {
  name: string;
  config: ProfileConfig;
}

export type CreateProfileResult =
  { ok: true; profile: ProfileDescriptor } | { ok: false; error: string };
