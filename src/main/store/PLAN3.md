# GitHub OAuth login + master-password DEK bootstrap (Step 1)

`RemoteSyncProvider` itself (push/pull/encrypt patches) is **explicitly deferred** —
see "Step 2" below. This pass only gets a `remote` profile as far as having a valid
`refreshToken`/`token`/`dek: Buffer` ready to hand to `ProfileManager.create()`.

## Context

`src/main/store/` already has a working local/mock-remote sync abstraction
(`ProfileManager` → `OfflineStore` + `SyncProvider`, see `src/main/store/PLAN.md`).
The `remote` case is a deliberate stub (`src/main/store/remoteSyncProvider.ts`):
`push`/`pull` both `throw new Error('not implemented')`. Nothing today can actually
produce the three secrets a `remote` `ProfileConfig` needs (`refreshToken`, `token`,
`dek: Buffer`) — there's no GitHub OAuth flow and no master-password UI anywhere in
this repo. The renderer's own `ProfileConfig` type
(`src/preload/store/types.d.ts:40-48`) currently omits the `remote` case entirely,
with the comment _"'remote' needs a DEK (Buffer) and PKCE tokens resolved by an OAuth
flow that doesn't exist yet."_ This plan builds exactly that.

The companion backend repo (`C:\Users\invisal\Desktop\Works\benpocket-backend\PLAN.md`)
specs the Cloudflare Worker this talks to: GitHub OAuth + JWT/refresh-token auth (§4),
and per-account envelope-encryption key storage (§4, `GET`/`PUT /api/account/key`).

End-to-end flow this plan implements:

1. User clicks **"Sign in with GitHub"** → Electron main runs the PKCE flow against
   the Worker's `/auth/github/start`, catches the `benpocket://...` deep-link
   callback, exchanges it at `POST /auth/token` → `{ accessToken, refreshToken }`.
2. Main calls `GET /api/account/key` with the fresh access token.
   - `{ hasKey: false }` (first login ever, any device) → renderer shows **"Create a
     master password"** → main generates a fresh random DEK and a fresh random
     `kdfSalt`, wraps the DEK under a key derived from `(password, kdfSalt)`,
     `PUT /api/account/key { wrappedDek, kdfSalt }`.
   - `{ hasKey: true, wrappedDek, kdfSalt, keyVersion }` (existing account) → renderer
     shows **"Enter your master password"** → main re-derives the wrapping key from
     `(password, kdfSalt)` and unwraps `wrappedDek`; a wrong password fails loudly
     (AES-GCM auth-tag mismatch) and the user can retry.
3. Renderer now has `{ apiBaseUrl, refreshToken, token, dek }` and calls
   `createProfile(name, { kind: 'remote', ... })`. `ProfileManager.create()` already
   works today for this (`src/main/store/profileManager.ts:154-170`) — it constructs
   `RemoteSyncProvider` via `createSyncProvider(descriptor, store, initialConfig)`,
   which (per Step 2, unimplemented) currently ignores `initialConfig` — so the profile
   _is_ created, but the secrets aren't persisted by that provider yet. This is a known,
   accepted gap until Step 2 lands (see "Out of scope").

## The wrapping-key salt: `kdfSalt`

Corrected against the real deployed backend, which rejected `PUT /api/account/key`
with _"wrappedDek and kdfSalt are required"_ — the earlier draft of this plan assumed
`PUT /api/account/key` only stored `{ wrappedDek }` and worked around the missing salt
by deriving one deterministically from `userId`. That assumption was wrong: the
backend actually has its own `kdfSalt` column and requires the client to generate and
submit one. This is also the better design (a real random salt per account, not one
derivable from a public value like `userId`), so this isn't a regression, just a fix.

- **Setup** (`hasKey: false`): `dek.ts`'s `generateKdfSalt()` makes a fresh random
  16-byte salt alongside the DEK; `PUT /api/account/key { wrappedDek, kdfSalt }` sends
  both (both base64-encoded).
- **Unlock** (`hasKey: true`): `GET /api/account/key` returns `{ hasKey: true,
wrappedDek, kdfSalt, keyVersion }` — the renderer carries `kdfSalt` through to the
  `enter-password` step alongside `wrappedDek`, and `deriveWrappingKey(password,
kdfSalt)` uses the salt the server handed back rather than recomputing anything.
- `decodeJwtSubject()` (previously used only to derive the userId-based salt) is now
  dead code and has been removed from `dek.ts`.

## Files

**New folder `src/main/auth/`** (sibling to `src/main/store/`, not nested under it —
this is app-level account auth, not per-profile sync/storage):

### `src/main/auth/pkce.ts` (new)

```ts
export function generatePkce(): { verifier: string; challenge: string };
// verifier: randomBytes(32).toString('base64url')
// challenge: createHash('sha256').update(verifier).digest('base64url')  -- S256
```

### `src/main/auth/deepLink.ts` (new)

Generic protocol registration + dispatch, no GitHub-specific knowledge (stays
provider-agnostic per backend `PLAN.md` §4's "Provider growth" note, for whenever a
second OAuth provider is added):

```ts
export function registerDeepLinkHandler(onUrl: (url: string) => void): void;
```

- `app.setAsDefaultProtocolClient('benpocket')` — in dev (`process.defaultApp`
  is `true` when unpackaged), pass `process.execPath` + `[path.resolve(process.argv[1])]`
  so Windows/Linux registration actually points at the dev entry script, not a bare
  Electron binary; skip those extra args in a packaged build.
- macOS: `app.on('open-url', (event, url) => { event.preventDefault(); onUrl(url); })`.
- Windows/Linux: requires `app.requestSingleInstanceLock()` called at the top of
  `src/main/index.ts` **before** `app.whenReady()` — if it returns `false`, the app
  must `app.quit()` immediately (Electron's documented pattern; a real behavioral
  change worth flagging since nothing calls this today, so a second app launch
  currently opens a second window instead of forwarding to the first instance). Then
  `app.on('second-instance', (event, argv) => { const url = argv.find(a => a.startsWith('benpocket://')); if (url) onUrl(url); })`.
- Cold-start deep-link (app not running yet when the link is clicked) is **not**
  handled — see "Out of scope"; acceptable because in this flow the app is always
  already running when the callback fires (it's the one that opened the browser).
- `electron-builder.yml`'s `appId`/`productName` are still unmodified boilerplate
  (`com.electron.app`/`temp-project`) — unrelated to whether `setAsDefaultProtocolClient`
  works at runtime (that's independent of installer identity), so no change needed
  there for `npm run dev` testing. Flagged as a **pre-packaging** follow-up only (a
  packaged build's installer needs its own `protocols:` registration to associate the
  scheme at the OS level outside of runtime `app.setAsDefaultProtocolClient` calls).

### `src/main/auth/githubAuth.ts` (new)

```ts
export function loginWithGithub(
  apiBaseUrl: string
): Promise<{ accessToken: string; refreshToken: string }>;
```

- Generates a PKCE pair, opens
  `shell.openExternal(`${apiBaseUrl}/auth/github/start?code_challenge=${challenge}&code_challenge_method=S256`)`.
- Registers a one-shot pending-login resolver (module-scope, since the callback
  arrives asynchronously via `deepLink.ts`'s `onUrl`, not as a return value); rejects
  with a timeout (~5 min, matching the backend's `state` JWT TTL — the user-facing
  window to complete GitHub's consent screen) if no callback arrives.
- On callback: parses `code` from `benpocket://auth/callback?code=<handoff>`,
  calls `POST ${apiBaseUrl}/auth/token { code, code_verifier }`, resolves with the
  returned tokens. Field names for that response aren't pinned in either PLAN.md —
  isolate parsing in one small helper so a naming mismatch against the real backend is
  a one-line fix once it's live.
- Only one login can be in flight at a time (single module-scope pending resolver) —
  acceptable since this is a user-initiated, modal-feeling flow (click button → system
  browser → back to app), not something triggered concurrently from multiple places.

### `src/main/auth/dek.ts` (new)

```ts
export function generateDek(): Buffer; // randomBytes(32)
export function generateKdfSalt(): Buffer; // randomBytes(16) -- server-stored, see "The wrapping-key salt" above
export function deriveWrappingKey(password: string, kdfSalt: Buffer): Buffer; // scryptSync(password, kdfSalt, 32)
export function wrapDek(dek: Buffer, wrappingKey: Buffer): Buffer; // AES-256-GCM, iv(12)||authTag(16)||ciphertext
export function unwrapDek(wrapped: Buffer, wrappingKey: Buffer): Buffer; // throws (auth-tag mismatch) on wrong password
```

Same AES-256-GCM layout `remoteCrypto.ts` will later use for patches (Step 2) — kept
as an independent, small module for now rather than sharing code with a file that
doesn't exist yet; worth deduplicating once Step 2 lands.

### `src/main/auth/accountKey.ts` (new)

```ts
export type AccountKeyStatus =
  { hasKey: false } | { hasKey: true; wrappedDek: string; kdfSalt: string; keyVersion: number };
export function getAccountKeyStatus(
  apiBaseUrl: string,
  accessToken: string
): Promise<AccountKeyStatus>;
export function putAccountKey(
  apiBaseUrl: string,
  accessToken: string,
  wrappedDek: string,
  kdfSalt: string
): Promise<void>;
```

Plain `fetch` with `Authorization: Bearer <accessToken>` — no refresh-on-401 handling
needed here (that's `remoteAuthClient.ts`'s job in Step 2); this only ever runs
immediately after a fresh login, so the access token is guaranteed unexpired.
`wrappedDek`/`kdfSalt` both travel as base64 strings (same JSON-transport convention
used throughout this codebase, e.g. `src/main/http-client/ipc/http.ts:124`).

### `src/main/auth/ipc.ts` (new)

```ts
export function registerAuthHandlers(): void;
```

Four handlers, each returning `{ ok: true; ... } | { ok: false; error: string }`
(matching the existing `SwitchProfileResult`/`SyncResult` convention in
`src/main/store/ipc.ts`):

- `auth:login-github` `(apiBaseUrl)` → `loginWithGithub()` → `{ accessToken, refreshToken }`.
- `auth:get-account-key-status` `(apiBaseUrl, accessToken)` → `getAccountKeyStatus()`.
- `auth:setup-master-password` `(apiBaseUrl, accessToken, password)` → generates a DEK
  and a `kdfSalt`, derives the wrapping key from `(password, kdfSalt)`, wraps,
  `putAccountKey(apiBaseUrl, accessToken, wrappedDek, kdfSalt)`, returns `{ dek }` (as
  bytes for IPC transport).
- `auth:unlock-master-password` `(wrappedDek, kdfSalt, password)` → purely local, no
  network call (the renderer already has both `wrappedDek` and `kdfSalt` from the
  status check) — derives the wrapping key from `(password, kdfSalt)`, `unwrapDek()`;
  a caught auth-tag failure returns `{ ok: false, error: 'Incorrect master
password.' }` (a normal, retryable outcome, not a crash) rather than propagating the
  raw decrypt exception.

A separate file/namespace from `src/main/store/ipc.ts`'s `profiles:*` channels (own
`auth:*` prefix) since this is account/auth-scoped, not profile-scoped — mirrors the
`src/main/auth/` vs `src/main/store/` folder split above.

### `src/main/index.ts` (edit)

- `app.requestSingleInstanceLock()` + early `app.quit()` on failure, before
  `app.whenReady()`.
- `registerDeepLinkHandler()` + `registerAuthHandlers()` alongside the existing
  `registerProfileHandlers()` call inside `app.whenReady().then(...)`.

### `src/preload/auth/api.ts` (new)

New `window.auth` bridge, single file (matching the majority preload convention --
`kuberneter/api.ts`, `file-explorer/api.ts` -- rather than `store/`'s two-file split),
own namespace matching the `window.profiles` /
`window.kuberneter` / `window.fileExplorer` per-domain pattern in
`src/preload/index.ts`) rather than bolting onto `ProfilesApi` — the surface here
(login, key-status, setup, unlock) is account-auth, not profile CRUD:

```ts
export interface AuthApi {
  loginGithub: (
    apiBaseUrl: string
  ) => Promise<
    { ok: true; accessToken: string; refreshToken: string } | { ok: false; error: string }
  >;
  getAccountKeyStatus: (
    apiBaseUrl: string,
    accessToken: string
  ) => Promise<{ ok: true; status: AccountKeyStatus } | { ok: false; error: string }>;
  setupMasterPassword: (
    apiBaseUrl: string,
    accessToken: string,
    password: string
  ) => Promise<{ ok: true; dek: Uint8Array } | { ok: false; error: string }>;
  unlockMasterPassword: (
    wrappedDek: string,
    kdfSalt: string,
    password: string
  ) => Promise<{ ok: true; dek: Uint8Array } | { ok: false; error: string }>;
}
```

Wired into `src/preload/index.ts`/`index.d.ts` exactly like the other bridges
(`contextBridge.exposeInMainWorld('auth', authApi)`).

### `src/preload/store/types.d.ts` (edit)

Widen `ProfileConfig` to include the `remote` variant (currently omitted, see
"Context" above) — copy the shape already defined in `src/main/store/types.ts`'s
`ProfileConfig['remote']` arm, which hasn't changed.

### `src/renderer/src/components/auth/GithubLoginDialog.tsx` (new)

New `components/auth/` folder (this is app-wide account UI, same reasoning as
`hooks/usePersistStore.ts` living outside the per-tool `tools/<name>/` convention per
`docs/receipts/tools.md`). Built on the shared `Dialog`/`Input`/`Button` components
(`docs/receipts/design.md`) — no new UI primitives needed.

Internal step state machine (`useState<'connect' | 'waiting-for-github' | 'create-password' | 'enter-password'>`):

1. **`connect`** — `Input` for profile name + `apiBaseUrl` (no persisted default yet;
   the backend isn't deployed, so this is a required free-text field for now — see
   `RemoteProfileDescriptor.apiBaseUrl` already being a per-profile value in
   `src/main/store/types.ts`). "Continue with GitHub" button → `window.auth.loginGithub(apiBaseUrl)`.
2. **`waiting-for-github`** — spinner/status text while the promise from step 1 is
   in flight (system browser is open).
3. On success, immediately call `window.auth.getAccountKeyStatus(apiBaseUrl, accessToken)`:
   - `hasKey: false` → **`create-password`**: password + confirm `Input`s, inline
     mismatch validation, "Create master password" button →
     `window.auth.setupMasterPassword(...)` → on success, have `dek`.
   - `hasKey: true` → **`enter-password`**: single password `Input`, "Unlock" button →
     `window.auth.unlockMasterPassword(...)` → wrong-password error shown inline,
     input stays open for retry (not a dead-end).
4. Once `dek` is in hand: `useProfilesStore().createProfile(name, { kind: 'remote', apiBaseUrl, provider: 'github', refreshToken, token: accessToken, dek })` (`dek` passed
   straight through as `Uint8Array` -- no `Buffer` conversion, since the renderer has
   no Node `Buffer` global; see `ProfileConfig`'s `dek: Uint8Array` note in
   `src/preload/store/types.d.ts`), close the dialog on success.

Every step surfaces its own inline error (network failure, GitHub-side cancel, wrong
password) rather than one generic dialog-level error banner, since each failure needs
a different recovery action (retry login vs. retry password vs. fix the URL).

### `src/renderer/src/components/layout/ProfileSwitcher.tsx` (edit)

Add a real (non-`__DEV__`-gated) "Sign in with GitHub…" entry above the existing dev-only
Mock Remote section, using the `Cloud` icon already imported for `kind: 'remote'`
(`kindIcon()`, line 17-18). Opens `GithubLoginDialog` in a controlled `Dialog.Root`.

## Testing

- `pkce.test.ts`: `generatePkce()`'s `challenge` is the correct base64url-SHA256 of
  `verifier`; two calls never collide.
- `dek.test.ts`: `wrapDek`→`unwrapDek` round-trips; `unwrapDek` throws on a wrapping
  key derived from the wrong password; `deriveWrappingKey` is deterministic for the
  same `(password, kdfSalt)` and differs across different `kdfSalt`s; `generateKdfSalt`
  never repeats across calls.
- `deepLink.ts` / `githubAuth.ts` / `accountKey.ts` / `ipc.ts` are thin Electron-API
  and `fetch` glue — not easily unit-tested in isolation; verified manually instead
  (see "Verification" below).

## Out of scope (flagged, not this pass)

- **`RemoteSyncProvider` itself (Step 2)** — `push`/`pull`/encryption of patches,
  auth-refresh-on-401 for the sync API, and actually persisting the secrets this plan
  produces into the profile's `OfflineStore` settings (`store.setSetting`). Until this
  lands, `RemoteSyncProvider` stays the existing stub — `createSyncProvider()`
  (`src/main/store/syncProvider.ts:39`) keeps calling `createRemoteSyncProvider()` with
  no arguments, so a `remote` profile _can_ be created via this plan's flow but its
  `refreshToken`/`token`/`dek` won't survive an app restart or be usable for sync yet.
  This is a deliberate, accepted gap for this pass, not an oversight — sequencing this
  way lets login/master-password UX be built and reviewed independently of the sync
  wire protocol. (Design for this step, when it's picked up, is preserved below.)
- **Cold-start deep link** (app not running when the GitHub redirect fires) — not
  reachable in this flow since the app always initiates the browser open itself;
  flagged as a minor robustness gap (e.g. user quits the app mid-flow), not a blocker.
- Recovery-phrase / QR-pairing / any secondary way to recover the master password if
  forgotten — backend `PLAN.md` §8 already flags this as an open question one layer up
  ("Master key transport to a new device"); this pass only implements the two paths
  the backend API actually supports today (create vs. unlock via password).
- `electron-builder.yml` packaged-build protocol association (`protocols:` config,
  `appId`/`productName` rename off the `com.electron.app`/`temp-project` boilerplate) —
  needed before shipping a real installer, not before `npm run dev` testing.

## Verification

- `npm run format && npm run lint && npm run typecheck && npm run knip` (per CLAUDE.md).
- `npx vitest run src/main/auth/pkce.test.ts src/main/auth/dek.test.ts`.
- No live backend to test against yet (`benpocket-backend` is still in planning) — this
  pass's manual check is necessarily partial: confirm the system browser opens to the
  expected `/auth/github/start` URL with a well-formed `code_challenge`, and that the
  master-password dialog steps render/validate correctly using a temporary mocked
  `window.auth` (e.g. via a scratch override in the browser devtools console) standing
  in for the real IPC responses. A true end-to-end run (real GitHub consent screen,
  real `/auth/token` exchange, real `/api/account/key`) has to wait until
  `benpocket-backend` is actually deployed somewhere reachable.
- Once a backend exists: click "Sign in with GitHub…" in `ProfileSwitcher`, confirm
  the system browser opens to `/auth/github/start`, complete GitHub's consent screen,
  confirm the app (already running) receives the `benpocket://` callback via
  `open-url` (macOS) or `second-instance` (Windows/Linux), confirm the correct
  create-password/enter-password branch renders based on `hasKey`, and confirm a wrong
  password on the unlock path shows a retryable inline error rather than crashing.

---

## Step 2 (deferred, not this pass): `RemoteSyncProvider`

Design preserved here for when this is picked up next — implements `push`/`pull`/
`close`, encryption, and auth-refresh for the actual doc-sync API
(`GET`/`POST /api/kv/patches`), consuming the `refreshToken`/`token`/`dek` Step 1
produces.

### Files

- **`src/main/store/remoteCrypto.ts`** (new) — `encryptPatch`/`decryptPatch`.
- **`src/main/store/remoteAuthClient.ts`** (new) — `createAuthFetch`, `RemoteAuthError`.
- **`src/main/store/remoteSyncProvider.ts`** (rewrite) — wires the above two together,
  implements `push`/`pull`/`close`.
- **`src/main/store/syncProvider.ts`** (edit) — pass `descriptor`/`store`/`initialConfig`
  through to `createRemoteSyncProvider`, drop the two now-stale
  `eslint-disable @typescript-eslint/no-unused-vars` comments.
- **`src/main/store/syncProvider.test.ts`** (edit) — the existing
  `"constructs a RemoteSyncProvider for kind: 'remote', which throws when used"` test
  no longer holds once `push`/`pull` do real work; replace with a construction-only
  smoke test or drop the case (real coverage moves to `remoteSyncProvider.test.ts`).

### 1. `remoteCrypto.ts`

AES-256-GCM via Node's built-in `crypto` (import style `from 'crypto'`, matching every
other file in this codebase — not `node:crypto`) — no new dependency.

```ts
export function encryptPatch(dek: Buffer, docKey: string, plaintext: Buffer): string;
export function decryptPatch(dek: Buffer, docKey: string, wire: string): Buffer;
```

- Layout: `iv(12 bytes) || authTag(16 bytes) || ciphertext`, base64-encoded as the wire
  string (matches `src/main/http-client/ipc/http.ts:124`'s base64-for-opaque-bytes
  convention). Base64-inside-JSON over a raw binary content-type because the push body
  per backend §5 is a JSON array mixing `clientId`/`docKey` with `patch`.
- Bind `docKey` as GCM AAD — turns a mislabeled/corrupted ciphertext into a loud
  decrypt failure instead of silently merging into the wrong Yjs doc.

### 2. `remoteAuthClient.ts`

```ts
export class RemoteAuthError extends Error {}
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}
export function createAuthFetch(params: {
  apiBaseUrl: string;
  tokens: AuthTokens;
  onTokensRefreshed: (tokens: AuthTokens) => void;
}): (path: string, init?: RequestInit) => Promise<Response>;
```

State machine per call:

1. Attach `Authorization: Bearer <accessToken>`, fetch.
2. Non-401 → return the `Response` as-is; status interpretation stays the caller's job.
3. 401 → `POST ${apiBaseUrl}/auth/refresh` with `Authorization: Bearer <refreshToken>`
   (backend §4: refresh token travels as a bearer token, not a JSON field).
   - Refresh itself fails → throw `RemoteAuthError('Your session has expired. Please sign in again.')`, no retry.
   - Refresh succeeds → update in-memory tokens, call `onTokensRefreshed` (persists via
     `store.setSetting`), retry the original request exactly once.
   - Retry also 401 → throw `RemoteAuthError`, no second refresh (bounded: one refresh
     - one retry per call, never a loop).
4. Non-401 network/DNS errors propagate unmodified.
5. Isolate response-shape parsing in one small `parseRefreshResponse(json)` helper.

### 3. `remoteSyncProvider.ts`

```ts
export function createRemoteSyncProvider(
  descriptor: RemoteProfileDescriptor,
  store: OfflineStore,
  initialConfig?: Extract<ProfileConfig, { kind: 'remote' }>
): SyncProvider;
```

- Settings keys: `remoteSync.accessToken`, `remoteSync.refreshToken`, `remoteSync.dek`
  (DEK stored as `dek.toString('base64')`; `store`'s `safeStorage` encryption already
  covers at-rest protection).
- `initialConfig` present (first creation only) → write all three settings once.
  Absent → read all three back via `getSetting` eagerly at construction; missing any
  → throw immediately, naming the missing key.
- Keep `{ accessToken, refreshToken }` as one mutable pair in closure, handed to
  `createAuthFetch`; `onTokensRefreshed` re-persists both. A single mutable pair is
  sufficient since `ProfileManager.sync()` calls `push()` then `pull()` sequentially,
  never concurrently.
- **`push(patches)`**: empty array → `[]`, no HTTP call. Otherwise encrypt each patch,
  `POST /api/kv/patches` via `authFetch`, map `{clientId, seq}[]` back to `PushAck[]`.
- **`pull(sinceSeq)`**: `GET /api/kv/patches?since=${sinceSeq}` via `authFetch`,
  decrypt each `{docKey, seq, patch}`, map to `RemotePatch[]`.
- **`close()`**: no-op, matching `LocalSyncProvider`.

### Testing (Step 2)

- `remoteCrypto.test.ts`: encrypt→decrypt round-trip; throws on wrong DEK; throws on
  tampered ciphertext; throws on mismatched `docKey` (AAD binding).
- `remoteSyncProvider.test.ts` (mock `fetch`, `Map`-backed fake `OfflineStore`):
  settings persist/reload correctly; `push([])` short-circuits; `push`/`pull` map
  fields correctly and attach the right `Authorization` header; a 401 triggers exactly
  one refresh + one retry and persists new tokens; refresh failure and retry-still-401
  both reject with `RemoteAuthError` without looping; `close()` doesn't throw.
- `syncProvider.test.ts`: update/remove the stale "throws when used" remote case.

### Out of scope within Step 2

- `GET /api/kv/status` precheck and `GET /api/kv/:key` full-state fallback — `OfflineStore`
  only has a single global `sync_cursor` today, not per-doc `baseline_seq` tracking.
- `POST /:key/compact` — unrelated to the `push`/`pull` shape `SyncProvider` needs.
- `POST /auth/logout` — nothing calls it today; `ProfileManager.delete()` only tears
  down local state, doesn't revoke the refresh token server-side.
