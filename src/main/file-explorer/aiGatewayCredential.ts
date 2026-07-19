import { ipcMain, app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { getR2Credential } from './r2Credential';

export interface AiGatewayCredential {
  accountId: string;
  apiToken: string;
  gatewayId: string;
  model: string;
}

// The gateway/model settings on their own -- accountId/apiToken come from the
// shared Cloudflare connection (r2Credential.ts) rather than being duplicated
// here, since it's the same Cloudflare account either way.
interface GatewaySettings {
  gatewayId: string;
  model: string;
}

const SETTINGS_FILENAME = 'ai-gateway-settings.json';

function settingsFilePath(): string {
  return path.join(app.getPath('userData'), SETTINGS_FILENAME);
}

// undefined = not loaded from disk yet; null = loaded, nothing saved.
let cachedSettings: GatewaySettings | null | undefined;

function loadFromDisk(): GatewaySettings | null {
  try {
    const raw = fs.readFileSync(settingsFilePath(), 'utf-8');
    return JSON.parse(raw) as GatewaySettings;
  } catch {
    return null;
  }
}

function getCachedSettings(): GatewaySettings | null {
  if (cachedSettings === undefined) {
    cachedSettings = loadFromDisk();
  }
  return cachedSettings;
}

/** Used by the agent's chat completion client -- never exposed to the renderer directly. */
export function getAiGatewayCredential(): AiGatewayCredential | null {
  const cloudflare = getR2Credential();
  const settings = getCachedSettings();
  if (!cloudflare || !settings) return null;

  return {
    accountId: cloudflare.accountId,
    apiToken: cloudflare.apiToken,
    gatewayId: settings.gatewayId,
    model: settings.model
  };
}

export function registerAiGatewayCredentialHandlers(): void {
  ipcMain.handle(
    'file-explorer:get-ai-gateway-credential-status',
    (): { configured: boolean; cloudflareConnected: boolean; gatewayId: string; model: string } => {
      const settings = getCachedSettings();
      return {
        configured: getR2Credential() !== null && settings !== null,
        cloudflareConnected: getR2Credential() !== null,
        gatewayId: settings?.gatewayId ?? '',
        model: settings?.model ?? ''
      };
    }
  );

  ipcMain.handle(
    'file-explorer:set-ai-gateway-credential',
    (_, gatewayId: string, model: string): { success: true } | { error: string } => {
      if (!getR2Credential()) {
        return { error: 'Connect Cloudflare first.' };
      }
      if (!gatewayId.trim() || !model.trim()) {
        return { error: 'Gateway ID and Model are both required.' };
      }

      const settings: GatewaySettings = { gatewayId, model };
      try {
        fs.mkdirSync(path.dirname(settingsFilePath()), { recursive: true });
        fs.writeFileSync(settingsFilePath(), JSON.stringify(settings), { mode: 0o600 });
        cachedSettings = settings;
        return { success: true };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { error: message };
      }
    }
  );

  ipcMain.handle('file-explorer:clear-ai-gateway-credential', (): void => {
    cachedSettings = null;
    try {
      fs.rmSync(settingsFilePath(), { force: true });
    } catch {
      // best-effort -- the in-memory cache is already cleared either way
    }
  });
}
