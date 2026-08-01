export type ProfileId = string;

export type ProfileKind = 'local' | 'remote' | 'mock-remote';

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

// Only the kinds creatable from the renderer today -- 'remote' needs a DEK
// (Buffer) and PKCE tokens resolved by an OAuth flow that doesn't exist yet.
export type ProfileConfig =
  | { kind: 'local' }
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
