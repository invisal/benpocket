import { ipcMain } from 'electron';
import type { OAuth2TokenRequest, OAuth2TokenResult } from '../../../preload/http-client/types';

interface TokenEndpointResponse {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

export function registerOAuth2Handlers(): void {
  ipcMain.handle(
    'http:oauth2GetToken',
    async (_event, payload: OAuth2TokenRequest): Promise<OAuth2TokenResult> => {
      const body = new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: payload.clientId,
        client_secret: payload.clientSecret
      });
      if (payload.scope) body.set('scope', payload.scope);

      try {
        const response = await fetch(payload.tokenUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: body.toString(),
          signal: AbortSignal.timeout(30000)
        });

        const data = (await response.json().catch(() => null)) as TokenEndpointResponse | null;

        if (!response.ok || !data?.access_token) {
          const reason = data?.error_description ?? data?.error ?? response.statusText;
          return { ok: false, error: `Token request failed (${response.status}): ${reason}` };
        }

        return {
          ok: true,
          accessToken: data.access_token,
          tokenType: data.token_type ?? 'Bearer',
          expiresIn: data.expires_in
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error fetching access token.';
        return { ok: false, error: message };
      }
    }
  );
}
