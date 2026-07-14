import { ipcMain, app, safeStorage } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

export interface R2Credential {
  accountId: string;
  apiToken: string;
  accessKeyId: string;
  secretAccessKey: string;
}

const CREDENTIAL_FILENAME = 'r2-credential.json';

function credentialFilePath(): string {
  return path.join(app.getPath('userData'), CREDENTIAL_FILENAME);
}

// accountId isn't secret; the other three fields are stored as base64-encoded
// safeStorage ciphertext, never written to disk in plaintext.
interface EncryptedCredentialFile {
  accountId: string;
  apiToken: string;
  accessKeyId: string;
  secretAccessKey: string;
}

// undefined = not loaded from disk yet; null = loaded, nothing saved.
let cachedCredential: R2Credential | null | undefined;

function loadFromDisk(): R2Credential | null {
  try {
    const raw = fs.readFileSync(credentialFilePath(), 'utf-8');
    const parsed = JSON.parse(raw) as EncryptedCredentialFile;
    return {
      accountId: parsed.accountId,
      apiToken: safeStorage.decryptString(Buffer.from(parsed.apiToken, 'base64')),
      accessKeyId: safeStorage.decryptString(Buffer.from(parsed.accessKeyId, 'base64')),
      secretAccessKey: safeStorage.decryptString(Buffer.from(parsed.secretAccessKey, 'base64'))
    };
  } catch {
    return null;
  }
}

function getCachedCredential(): R2Credential | null {
  if (cachedCredential === undefined) {
    cachedCredential = loadFromDisk();
  }
  return cachedCredential;
}

/** Used by R2FileDriver -- never exposed to the renderer directly. */
export function getR2Credential(): R2Credential | null {
  return getCachedCredential();
}

export function registerR2CredentialHandlers(): void {
  ipcMain.handle('file-explorer:get-r2-credential-status', (): { configured: boolean } => {
    return { configured: getCachedCredential() !== null };
  });

  ipcMain.handle(
    'file-explorer:set-r2-credential',
    (
      _,
      accountId: string,
      apiToken: string,
      accessKeyId: string,
      secretAccessKey: string
    ): { success: true } | { error: string } => {
      if (!accountId.trim() || !apiToken.trim() || !accessKeyId.trim() || !secretAccessKey.trim()) {
        return { error: 'All four fields are required.' };
      }
      if (!safeStorage.isEncryptionAvailable()) {
        return { error: 'OS-level credential encryption is not available on this machine.' };
      }

      const encrypted: EncryptedCredentialFile = {
        accountId,
        apiToken: safeStorage.encryptString(apiToken).toString('base64'),
        accessKeyId: safeStorage.encryptString(accessKeyId).toString('base64'),
        secretAccessKey: safeStorage.encryptString(secretAccessKey).toString('base64')
      };

      try {
        fs.mkdirSync(path.dirname(credentialFilePath()), { recursive: true });
        fs.writeFileSync(credentialFilePath(), JSON.stringify(encrypted), { mode: 0o600 });
        cachedCredential = { accountId, apiToken, accessKeyId, secretAccessKey };
        return { success: true };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { error: message };
      }
    }
  );

  ipcMain.handle('file-explorer:clear-r2-credential', (): void => {
    cachedCredential = null;
    try {
      fs.rmSync(credentialFilePath(), { force: true });
    } catch {
      // best-effort -- the in-memory cache is already cleared either way
    }
  });
}
