/** Signals "the user needs to sign in again" -- distinguishable from a transient network/HTTP failure. */
export class RemoteAuthError extends Error {}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export type AuthFetch = (path: string, init?: RequestInit) => Promise<Response>;

export interface CreateAuthFetchParams {
  apiBaseUrl: string;
  tokens: AuthTokens;
  /** Called synchronously right after a successful refresh, before the retried request fires. */
  onTokensRefreshed: (tokens: AuthTokens) => void;
}

/**
 * Wraps `fetch` with a bounded 401-refresh-and-retry state machine: attach
 * the current access token, and on a 401, refresh once via
 * `POST /auth/refresh` (refresh token travels as a `{ refreshToken }` JSON
 * body -- see benpocket-backend src/routes/auth.ts's `/refresh` handler,
 * which 400s if it's sent as a bearer header instead) and retry the original
 * request exactly once. Never loops -- a second 401 after a successful
 * refresh, or a failed refresh itself, both throw RemoteAuthError rather
 * than retrying again. Status interpretation beyond 401 (`response.ok`,
 * body parsing) stays the caller's job.
 */
export function createAuthFetch(params: CreateAuthFetchParams): AuthFetch {
  const baseUrl = params.apiBaseUrl.replace(/\/+$/, '');
  let tokens = params.tokens;
  // Dedupes concurrent 401s (e.g. a status precheck racing a push/pull) onto
  // one /auth/refresh call -- otherwise two callers both read the
  // not-yet-rotated refreshToken and the second's refresh gets rejected by
  // the backend as already-used, surfacing as a spurious "session expired".
  let refreshInFlight: Promise<void> | null = null;

  async function request(
    path: string,
    init: RequestInit | undefined,
    accessToken: string
  ): Promise<Response> {
    console.log(`[remoteAuth] DEBUG request: ${init?.method ?? 'GET'} ${path}`);
    const headers = new Headers(init?.headers);
    headers.set('Authorization', `Bearer ${accessToken}`);
    return fetch(`${baseUrl}${path}`, { ...init, headers });
  }

  async function performRefresh(): Promise<void> {
    console.log('[remoteAuth] DEBUG refreshing access token via /auth/refresh');
    const response = await fetch(`${baseUrl}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: tokens.refreshToken })
    });

    if (!response.ok) {
      const body = await response.text();
      console.log(`[remoteAuth] DEBUG refresh failed: ${response.status} ${body.slice(0, 500)}`);
      throw new RemoteAuthError('Your session has expired. Please sign in again.');
    }

    const refreshed = parseRefreshResponse(await response.json());
    tokens = refreshed;
    params.onTokensRefreshed(refreshed);
    console.log('[remoteAuth] DEBUG refresh succeeded, tokens updated');
  }

  function refresh(): Promise<void> {
    if (!refreshInFlight) {
      refreshInFlight = performRefresh().finally(() => {
        refreshInFlight = null;
      });
    }
    return refreshInFlight;
  }

  return async function authFetch(path, init) {
    const response = await request(path, init, tokens.accessToken);
    if (response.status !== 401) return response;

    console.log(`[remoteAuth] DEBUG got 401 on ${path}, need to refresh token`);
    await refresh();

    const retryResponse = await request(path, init, tokens.accessToken);
    if (retryResponse.status === 401) {
      throw new RemoteAuthError('Re-authentication required.');
    }
    return retryResponse;
  };
}

// Matches benpocket-backend's `POST /auth/refresh` response shape
// (`{ accessToken, refreshToken, expiresIn }` -- `expiresIn` unused here).
function parseRefreshResponse(json: unknown): AuthTokens {
  const body = json as { accessToken?: unknown; refreshToken?: unknown };
  if (typeof body.accessToken !== 'string' || typeof body.refreshToken !== 'string') {
    throw new Error('Unexpected response from /auth/refresh.');
  }
  return { accessToken: body.accessToken, refreshToken: body.refreshToken };
}
