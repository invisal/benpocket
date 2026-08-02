import { shell } from 'electron';
import { generatePkce } from './pkce';

// Matches the backend's short-lived `state` JWT TTL -- the user-facing window
// to complete GitHub's consent screen before the whole attempt is abandoned.
const LOGIN_TIMEOUT_MS = 5 * 60 * 1000;

export interface GithubTokens {
  accessToken: string;
  refreshToken: string;
}

interface PendingLogin {
  verifier: string;
  apiBaseUrl: string;
  resolve: (tokens: GithubTokens) => void;
  reject: (err: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

// Module-scope, single-slot: only one GitHub sign-in can be in flight at a
// time. Acceptable since this is a user-initiated, modal-feeling flow (click
// button -> system browser -> back to app), not something triggered
// concurrently from multiple places.
let pending: PendingLogin | null = null;

function settle(action: (login: PendingLogin) => void): void {
  if (!pending) return;
  const login = pending;
  pending = null;
  clearTimeout(login.timeout);
  action(login);
}

/**
 * Opens the system browser at the Worker's PKCE-protected `/auth/github/start`
 * and resolves once the `benpocket://auth/callback` deep link comes back (via
 * handleGithubDeepLink, wired to deepLink.ts's dispatch in
 * src/main/index.ts) and the resulting code has been exchanged for tokens.
 */
export function loginWithGithub(apiBaseUrl: string): Promise<GithubTokens> {
  if (pending) {
    return Promise.reject(new Error('A GitHub sign-in is already in progress.'));
  }

  const baseUrl = apiBaseUrl.replace(/\/+$/, '');
  const { verifier, challenge } = generatePkce();

  return new Promise<GithubTokens>((resolve, reject) => {
    const timeout = setTimeout(() => {
      settle((login) => login.reject(new Error('Sign-in timed out. Please try again.')));
    }, LOGIN_TIMEOUT_MS);

    pending = { verifier, apiBaseUrl: baseUrl, resolve, reject, timeout };

    const startUrl = `${baseUrl}/auth/github/start?code_challenge=${encodeURIComponent(challenge)}&code_challenge_method=S256`;
    void shell.openExternal(startUrl).catch((err: unknown) => {
      settle((login) =>
        login.reject(err instanceof Error ? err : new Error('Could not open the system browser.'))
      );
    });
  });
}

/** Wired as deepLink.ts's onUrl callback -- see src/main/index.ts. */
export function handleGithubDeepLink(url: string): void {
  if (!pending) return;

  let code: string | null = null;
  try {
    code = new URL(url).searchParams.get('code');
  } catch {
    code = null;
  }

  if (!code) {
    settle((login) =>
      login.reject(new Error('GitHub sign-in callback was missing an authorization code.'))
    );
    return;
  }

  const login = pending;
  exchangeCode(login.apiBaseUrl, code, login.verifier).then(
    (tokens) => settle((current) => current.resolve(tokens)),
    (err: unknown) =>
      settle((current) =>
        current.reject(err instanceof Error ? err : new Error('GitHub sign-in failed.'))
      )
  );
}

async function exchangeCode(
  apiBaseUrl: string,
  code: string,
  verifier: string
): Promise<GithubTokens> {
  const response = await fetch(`${apiBaseUrl}/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, code_verifier: verifier })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GitHub sign-in failed: ${response.status} ${body.slice(0, 500)}`);
  }

  return parseTokenResponse(await response.json());
}

// Isolated on its own: the exact field names /auth/token returns aren't
// pinned in either PLAN.md, so a naming mismatch against the real backend is
// a one-line fix here once it's live.
function parseTokenResponse(json: unknown): GithubTokens {
  const body = json as { accessToken?: unknown; refreshToken?: unknown };
  if (typeof body.accessToken !== 'string' || typeof body.refreshToken !== 'string') {
    throw new Error('Unexpected response from /auth/token.');
  }
  return { accessToken: body.accessToken, refreshToken: body.refreshToken };
}
