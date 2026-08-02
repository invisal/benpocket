import { ipcRenderer } from 'electron';

export type AccountKeyStatus =
  { hasKey: false } | { hasKey: true; wrappedDek: string; kdfSalt: string; keyVersion: number };

export type LoginGithubResult =
  { ok: true; accessToken: string; refreshToken: string } | { ok: false; error: string };

export type AccountKeyStatusResult =
  { ok: true; status: AccountKeyStatus } | { ok: false; error: string };

export type MasterPasswordResult = { ok: true; dek: Uint8Array } | { ok: false; error: string };

export interface AuthApi {
  /** Opens the system browser for GitHub sign-in and resolves once the deep-link callback completes. */
  loginGithub: (apiBaseUrl: string) => Promise<LoginGithubResult>;
  /** Whether this account already has a wrapped DEK on the server -- decides create-password vs. enter-password UI. */
  getAccountKeyStatus: (apiBaseUrl: string, accessToken: string) => Promise<AccountKeyStatusResult>;
  /** First-ever login: generates a fresh DEK + kdfSalt, wraps the DEK under the given password, and saves both server-side. */
  setupMasterPassword: (
    apiBaseUrl: string,
    accessToken: string,
    password: string
  ) => Promise<MasterPasswordResult>;
  /** Existing account, new device: unwraps wrappedDek using kdfSalt + the given password (purely local, no network call). */
  unlockMasterPassword: (
    wrappedDek: string,
    kdfSalt: string,
    password: string
  ) => Promise<MasterPasswordResult>;
}

export const authApi: AuthApi = {
  loginGithub: (apiBaseUrl) => ipcRenderer.invoke('auth:login-github', apiBaseUrl),
  getAccountKeyStatus: (apiBaseUrl, accessToken) =>
    ipcRenderer.invoke('auth:get-account-key-status', apiBaseUrl, accessToken),
  setupMasterPassword: (apiBaseUrl, accessToken, password) =>
    ipcRenderer.invoke('auth:setup-master-password', apiBaseUrl, accessToken, password),
  unlockMasterPassword: (wrappedDek, kdfSalt, password) =>
    ipcRenderer.invoke('auth:unlock-master-password', wrappedDek, kdfSalt, password)
};
