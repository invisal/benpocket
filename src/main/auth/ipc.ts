import { ipcMain } from 'electron';
import { getAccountKeyStatus, putAccountKey, type AccountKeyStatus } from './accountKey';
import { deriveWrappingKey, generateDek, generateKdfSalt, unwrapDek, wrapDek } from './dek';
import { loginWithGithub, type GithubTokens } from './githubAuth';

type LoginGithubResult = ({ ok: true } & GithubTokens) | { ok: false; error: string };
type AccountKeyStatusResult = { ok: true; status: AccountKeyStatus } | { ok: false; error: string };
type MasterPasswordResult = { ok: true; dek: Uint8Array } | { ok: false; error: string };

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Something went wrong.';
}

export function registerAuthHandlers(): void {
  ipcMain.handle(
    'auth:login-github',
    async (_event, apiBaseUrl: string): Promise<LoginGithubResult> => {
      try {
        const tokens = await loginWithGithub(apiBaseUrl);
        return { ok: true, ...tokens };
      } catch (err) {
        return { ok: false, error: errorMessage(err) };
      }
    }
  );

  ipcMain.handle(
    'auth:get-account-key-status',
    async (_event, apiBaseUrl: string, accessToken: string): Promise<AccountKeyStatusResult> => {
      try {
        return { ok: true, status: await getAccountKeyStatus(apiBaseUrl, accessToken) };
      } catch (err) {
        return { ok: false, error: errorMessage(err) };
      }
    }
  );

  ipcMain.handle(
    'auth:setup-master-password',
    async (
      _event,
      apiBaseUrl: string,
      accessToken: string,
      password: string
    ): Promise<MasterPasswordResult> => {
      try {
        const dek = generateDek();
        const kdfSalt = generateKdfSalt();
        const wrappingKey = deriveWrappingKey(password, kdfSalt);
        const wrapped = wrapDek(dek, wrappingKey);
        await putAccountKey(
          apiBaseUrl,
          accessToken,
          wrapped.toString('base64'),
          kdfSalt.toString('base64')
        );
        return { ok: true, dek };
      } catch (err) {
        return { ok: false, error: errorMessage(err) };
      }
    }
  );

  ipcMain.handle(
    'auth:unlock-master-password',
    (_event, wrappedDek: string, kdfSalt: string, password: string): MasterPasswordResult => {
      try {
        const wrappingKey = deriveWrappingKey(password, Buffer.from(kdfSalt, 'base64'));
        const dek = unwrapDek(Buffer.from(wrappedDek, 'base64'), wrappingKey);
        return { ok: true, dek };
      } catch {
        // Any failure here (auth-tag mismatch from a wrong password, or a
        // malformed wrappedDek/kdfSalt) reads as "wrong password" to the
        // user -- the one thing that's actually retryable from this dialog.
        return { ok: false, error: 'Incorrect master password.' };
      }
    }
  );
}
