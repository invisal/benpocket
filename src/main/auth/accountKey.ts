export type AccountKeyStatus =
  { hasKey: false } | { hasKey: true; wrappedDek: string; kdfSalt: string; keyVersion: number };

// Plain fetch, no refresh-on-401 handling -- this only ever runs immediately
// after a fresh login (see githubAuth.ts), so the access token is guaranteed
// unexpired. RemoteSyncProvider's authFetch (deferred, see PLAN3.md Step 2)
// is where refresh-on-401 belongs for the ongoing-sync case.

export async function getAccountKeyStatus(
  apiBaseUrl: string,
  accessToken: string
): Promise<AccountKeyStatus> {
  const response = await fetch(`${apiBaseUrl}/api/account/key`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Could not check account key status: ${response.status} ${body.slice(0, 500)}`);
  }

  const json = (await response.json()) as {
    hasKey?: unknown;
    wrappedDek?: unknown;
    kdfSalt?: unknown;
    keyVersion?: unknown;
  };
  if (json.hasKey === false) return { hasKey: false };
  if (
    json.hasKey === true &&
    typeof json.wrappedDek === 'string' &&
    typeof json.kdfSalt === 'string' &&
    typeof json.keyVersion === 'number'
  ) {
    return {
      hasKey: true,
      wrappedDek: json.wrappedDek,
      kdfSalt: json.kdfSalt,
      keyVersion: json.keyVersion
    };
  }
  throw new Error('Unexpected response from GET /api/account/key.');
}

export async function putAccountKey(
  apiBaseUrl: string,
  accessToken: string,
  wrappedDek: string,
  kdfSalt: string
): Promise<void> {
  const response = await fetch(`${apiBaseUrl}/api/account/key`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ wrappedDek, kdfSalt })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Could not save account key: ${response.status} ${body.slice(0, 500)}`);
  }
}
