interface OAuth2Config {
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  scope?: string;
}

interface CachedToken {
  accessToken: string;
  tokenType: string;
  expiresAt: number;
}

// In-memory only - never written to disk. Fetched tokens are short-lived and
// re-fetchable, so there's nothing to gain from persisting them and it avoids
// a second place secrets could leak from (see AuthEditor.tsx for the
// client secret's own storage tradeoff).
const cache = new Map<string, CachedToken>();

function cacheKey(config: OAuth2Config): string {
  return JSON.stringify([
    config.tokenUrl,
    config.clientId,
    config.clientSecret,
    config.scope ?? ''
  ]);
}

/** Cache-only lookup, for synchronous contexts like the Headers-tab preview - never fetches. */
export function getCachedOAuth2Token(config: OAuth2Config): CachedToken | null {
  const entry = cache.get(cacheKey(config));
  if (!entry || Date.now() >= entry.expiresAt) return null;
  return entry;
}

/** Returns a valid cached token, fetching a new one via the main process if missing/expired/forced. */
export async function getOrFetchOAuth2Token(
  config: OAuth2Config,
  opts?: { force?: boolean }
): Promise<CachedToken> {
  if (!opts?.force) {
    const cached = getCachedOAuth2Token(config);
    if (cached) return cached;
  }

  const result = await window.api.http.oauth2GetToken(config);
  if (!result.ok || !result.accessToken) {
    throw new Error(result.error ?? 'Failed to fetch access token.');
  }

  // 30s safety margin so a token doesn't expire mid-flight to the server.
  const expiresAt = Date.now() + Math.max(0, (result.expiresIn ?? 3600) - 30) * 1000;
  const entry: CachedToken = {
    accessToken: result.accessToken,
    tokenType: result.tokenType ?? 'Bearer',
    expiresAt
  };
  cache.set(cacheKey(config), entry);
  return entry;
}
