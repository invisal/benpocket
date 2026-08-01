# Profile system: abstract interface design

## Context

BenPocket currently assumes exactly **one** local device and **one remote**:

- `src/main/store/db.ts` opens a single singleton `userData/store.db` (`node:sqlite`), migrated once via `src/main/store/migrations.ts`; `src/main/store/{settings,patches,cursor,snapshot}.ts` all read/write that one db.
- `src/main/sync/{index,push,pull}.ts` push/pull Yjs patches against that one remote, protected by a passphrase-derived DEK (`src/main/auth/masterKey.ts`) escrowed so any device can recover it.

The ask is to generalize this into a **profile system**: a local profile, plus any number of remote profiles, each with its own isolated sqlite db + migrations, plus a "mock-remote" profile kind that fakes a remote backend entirely locally (for testing sync flows without a live server). Remote profiles still need that same enveloped-encryption idea — a portable, passphrase-derived DEK — just per-profile instead of global. How a remote profile actually authenticates and talks to its server is deliberately out of scope here (see `RemoteSyncProvider` below, which is left unimplemented on purpose); this doc is only about getting the local/remote/mock-remote abstraction right.

This is an **interface-design-only** deliverable — no implementation. The goal is to agree on the shape of the abstraction before writing any code.

## `ProfileManager` — the starting point

`ProfileManager` is the only interface any caller (IPC handlers, UI-facing code) ever touches — a **facade** over everything below it. It never exposes `SyncProvider` or `OfflineStore` directly; it composes one of each per profile internally (generalizing `workspaces.ts`'s `getOrCreateDefaultWorkspace` plus today's `store/ipc.ts` + `sync/index.ts` orchestration).

All data/lifecycle verbs operate implicitly on the **active** profile (whichever `switchProfile` last selected) — one open profile context at a time, matching how the app behaves today. Concurrent access to multiple profiles is a deliberate future extension, not something to build in now.

There is no lock/unlock or login/logout state to gate any of this on: whatever a profile's `SyncProvider` needs (a DEK, a refresh token, an access token) is resolved once at `create()` time from `ProfileConfig` and persisted by that provider itself from then on (see `SyncProvider` below) — `ProfileManager` never touches these values directly, it just passes `config` through once. So every verb here is always callable — `sync()` is simply a no-op for `kind: 'local'` rather than something callers need to branch around.

```ts
interface CreateProfileOptions {
  name: string;
  config: ProfileConfig; // see ProfileConfig below
}

interface ProfileManager {
  // Profile lifecycle
  list(): ProfileDescriptor[];
  getActive(): ProfileDescriptor;
  switchProfile(profileId: ProfileId): void;
  create(options: CreateProfileOptions): ProfileDescriptor;
  delete(profileId: ProfileId): void; // should refuse to delete the last 'local' profile, mirroring workspaces.ts's last-workspace guard

  /** Idempotent; guarantees exactly one 'local' profile exists. Called at app startup. */
  ensureDefaultLocalProfile(): ProfileDescriptor;

  // Data access on the active profile -- thin delegation to its OfflineStore.
  loadSnapshot(key: string): Promise<Buffer | null>;
  appendPatch(key: string, patch: Buffer): Promise<void>;

  // Mediates the active profile's OfflineStore and SyncProvider (both defined
  // below) -- no-op for 'local' since LocalSyncProvider.push()/pull() both
  // resolve to []. Generalizes sync/index.ts's runSync().
  sync(): Promise<void>;
}
```

`create()`'s job, for a `remote`/`mock-remote` profile, is just: open the new profile's `OfflineStore`, then hand `config` to `createSyncProvider()` once so the provider can persist whatever it privately needs — `ProfileManager` never inspects `config.dek`/`refreshToken`/`token` itself.

`sync()`'s body is exactly the hand-off between the next two sections — note that what crosses this boundary is always **plaintext**; each `SyncProvider` implementation encrypts/decrypts internally (or doesn't, for `local`) using whatever it privately holds:

```ts
async function sync(offline: OfflineStore, provider: SyncProvider): Promise<void> {
  offline.markPushed(await provider.push(offline.listUnpushedPatches()));
  offline.applyRemotePatches(await provider.pull(offline.getSyncCursor()));
}
```

Everything from here down (`SyncProvider`, `OfflineStore`, `ProfileDescriptor`, `ProfileConfig`) exists only to explain what `ProfileManager` composes internally — none of it is part of the public surface.

## `SyncProvider` — push/pull sync + its own crypto, composed by `ProfileManager`

Internal collaborator, composed by `ProfileManager` — not part of its public surface. Owns two things per profile: reaching whatever the sync target is (push/pull), and protecting data specifically for that target — a DEK, plus (for `remote`) a `refreshToken`/`token` for authenticated HTTP calls. These are private implementation state of each concrete provider, not part of the `SyncProvider` contract itself, and never seen by `OfflineStore` or `ProfileManager`.

This split exists because `OfflineStore` (below) protects data _at rest on this device_ via `safeStorage`, which is inherently device-bound and can't travel. A `remote` profile's data needs to be decryptable by _another_ device after round-tripping through a shared backend that never talks device-to-device directly — that needs a portable key (the DEK, escrowed via passphrase), which is a sync-layer concern, not a local-storage one. `local` profiles never leave the device, so `LocalSyncProvider` needs none of this at all. `MockSyncProvider` deliberately skips it too, even though a real `remote` wouldn't -- see below.

```ts
interface PendingPatch {
  localId: number; // OfflineStore's own row id -- echoed back in PushAck to mark as pushed
  docKey: string;
  patch: Buffer; // plaintext -- the provider encrypts internally before it leaves this device, if it encrypts at all
  createdAt: number;
}

interface PushAck {
  localId: number; // correlates back to PendingPatch.localId
  remoteSeq: number; // server- (or mock-server-) assigned sequence number
}

interface RemotePatch {
  docKey: string;
  remoteSeq: number;
  patch: Buffer; // plaintext -- the provider has already decrypted this before returning it
}

interface SyncProvider {
  push(patches: PendingPatch[]): Promise<PushAck[]>;
  pull(sinceSeq: number): Promise<RemotePatch[]>;
}

// Not an interface -- there's only ever one implementation of this (a plain
// switch on descriptor.kind), so it's ProfileManager's internal dispatch
// helper, not an abstraction with multiple implementations like SyncProvider
// itself. `initialConfig` is only meaningful the first time a profile is
// created -- the concrete provider persists whatever it needs (DEK,
// refreshToken, token) into `store`'s generic settings KV right then, under
// keys of its own choosing. On every later open, `initialConfig` is omitted
// and the provider reads its own state back out of `store` instead.
declare function createSyncProvider(
  descriptor: ProfileDescriptor,
  store: OfflineStore,
  initialConfig?: ProfileConfig
): SyncProvider;
```

- **`LocalSyncProvider`** (`kind: 'local'`) — holds no state at all. `push()`/`pull()` both resolve to `[]` immediately. No branching needed anywhere else; `ProfileManager.sync()` stays uniform across all three kinds.
- **`RemoteSyncProvider`** (`kind: 'remote'`) — **intentionally left unimplemented for now.** `push()`/`pull()` both `throw new Error('not implemented')`; it exists only so `createSyncProvider()` has a real case for `kind: 'remote'` to construct. The eventual real version would hold a DEK plus `refreshToken`/`token` (seeded from `initialConfig`, persisted via `store.setSetting`), encrypt each patch before the HTTP call to `apiBaseUrl` (generalizing `sync/push.ts`/`sync/pull.ts`), and refresh `token` on 401 (generalizing `auth/client.ts`'s `authFetch`) — but that detail is beyond this pass; getting the abstraction right comes first.
- **`MockSyncProvider`** (`kind: 'mock-remote'`) — **no encryption at all**, by choice, so its stored patches are directly readable in tests without decrypting anything. Opens its own sqlite file (`mockServerDbFile`) with one fixed schema (a `patches(docKey, seq, patch)` table) created via `CREATE TABLE IF NOT EXISTS` on open -- no versioned migration list needed, since this schema is a test-only artifact that won't evolve independently. `push()`/`pull()` read/write that file directly, tracking a globally-incrementing seq exactly like a real server would. Two `MockSyncProvider`s pointed at the same `mockServerDbFile` simulate "two devices, one account" for exercising sync end-to-end without a live server.

## `OfflineStore` — local sqlite, encrypted via `safeStorage`, composed by `ProfileManager`

Internal collaborator, composed by `ProfileManager` — not part of its public surface. Generalizes `store/db.ts` + `store/migrations.ts` + `store/settings.ts` + `store/patches.ts`/`cursor.ts`/`snapshot.ts` (already `db`-parameterized, no signature changes needed) plus `store/key.ts` — but simpler than any earlier draft: `OfflineStore` has no DEK, no passphrase, no cross-device concept at all. Every value it stores (patches, snapshots, and whatever a `SyncProvider` persists via the settings KV) is protected purely by `safeStorage`, uniformly, for every profile kind — because everything `OfflineStore` holds only ever needs to be read _on this device_. Portability across devices is entirely `SyncProvider`'s problem (see above), not this one's.

No separate registry type: `ProfileManager` holds its own `Map<ProfileId, OfflineStore>` cache internally and calls `.open()` the first time a profile becomes active (at `create()` or at `switchProfile()`/app startup), reusing the same instance after that.

```ts
interface OfflineStore {
  readonly profileId: ProfileId;

  /** Opens (creates if missing) this profile's sqlite file and runs any
   * pending migrations -- same idempotent PRAGMA user_version loop as
   * today's runMigrations, safe to call every time, not just the first. */
  open(): Promise<void>;
  close(): void;

  // Encrypts internally via safeStorage before writing; decrypts on read.
  appendPatch(key: string, patch: Buffer): Promise<void>;
  loadSnapshot(key: string): Promise<Buffer | null>;

  // Generic, safeStorage-encrypted per-value KV -- generalizes store/settings.ts.
  // OfflineStore doesn't know or care what's stored here; it's how each
  // SyncProvider persists its own private state (DEK, refreshToken, token)
  // across app restarts, under keys of its own choosing.
  getSetting(key: string): string | undefined;
  setSetting(key: string, value: string): void;

  // Sync-support, called only by ProfileManager.sync() to mediate with a
  // SyncProvider -- never called directly by any other caller. Patches here
  // are plaintext; SyncProvider handles its own encryption on the way out/in.
  // No allowlist/scoping: every patch in this profile gets synced, full stop --
  // there's no equivalent of today's store/syncScope.ts in this design.
  listUnpushedPatches(): PendingPatch[];
  markPushed(acks: PushAck[]): void;
  getSyncCursor(): number;
  applyRemotePatches(patches: RemotePatch[]): void; // also advances the cursor
}

// Unchanged from store/migrations.ts -- already takes a db instance, not a
// singleton reference, so it slots into OfflineStore.open() verbatim:
declare function runMigrations(db: DatabaseSync): void;
```

Every profile gets the identical schema (`settings`, `patches`, `sync_cursor`, `sync_snapshot`) via the same migrations array. **No `key_domain` column** (unlike today's `patches` table) — there's no DEK inside `OfflineStore` at all anymore, so there's nothing to have two domains of.

## Where the profile list lives

**A JSON manifest at `userData/profiles.json`**, not a sqlite table — mirrors the existing precedent in `src/main/http-client/ipc/workspaces.ts` (`postman-workspaces.json`) for "list of things + which is active/default." A sqlite-backed registry has a bootstrapping problem: you need to know which db file to open before you can query anything, so the thing that says "which db files exist" can't itself live inside one of those dbs.

Each profile's own sqlite file lives under `userData/profiles/<id>.db`; the manifest just tracks metadata, never secrets.

```ts
type ProfileId = string; // crypto.randomUUID(), same as workspaces.ts's Workspace.id

interface ProfileManifest {
  version: 1;
  activeProfileId: ProfileId;
  profiles: ProfileDescriptor[];
}

interface ProfileDescriptorCommon {
  id: ProfileId;
  name: string;
  createdAt: number;
  updatedAt: number;
  /** Filename under userData/profiles/, e.g. `${id}.db` — resolved by ProfileManager when it opens this profile's OfflineStore, never an absolute path. */
  dbFile: string;
}

type ProfileDescriptor =
  LocalProfileDescriptor | RemoteProfileDescriptor | MockRemoteProfileDescriptor;

interface LocalProfileDescriptor extends ProfileDescriptorCommon {
  kind: 'local';
}

interface RemoteProfileDescriptor extends ProfileDescriptorCommon {
  kind: 'remote';
  apiBaseUrl: string; // was the hardcoded API_BASE_URL in auth/githubAuth.ts — now per-profile
  provider: 'github'; // discriminant left open for future providers
}

interface MockRemoteProfileDescriptor extends ProfileDescriptorCommon {
  kind: 'mock-remote';
  /** Second local sqlite file under userData/profiles/ standing in for "the server" — see SyncProvider above. */
  mockServerDbFile: string;
}
```

No `accountId` field: which account a `remote` profile is signed into is fully captured by _that profile's own_ `SyncProvider` state, so the profile itself is the account boundary.

## `ProfileKind` / `ProfileConfig`

Config (creation input) is kept separate from descriptor (persisted record), mirroring the `name` argument vs. full `Workspace` record split already in `workspaces.ts`.

The OAuth login (PKCE, external browser redirect) and the master-password setup/unlock (to obtain the DEK — whether that's generating a fresh one on a first device or unwrapping the existing escrowed one on a subsequent device) both happen in the **renderer**, driven by IPC, before `create()` is ever called. By the time `create()` runs, those are already resolved — `ProfileConfig` for `remote` just carries the results, which `createSyncProvider()` consumes once (see `SyncProvider` above) to persist into that profile's own `OfflineStore`; there's no `login()`/`setup()` verb for `ProfileManager` itself to perform:

```ts
type ProfileKind = 'local' | 'remote' | 'mock-remote';

type ProfileConfig =
  | { kind: 'local' }
  | {
      kind: 'remote';
      apiBaseUrl: string;
      provider: 'github';
      refreshToken: string; // from the renderer-driven PKCE flow (auth/githubAuth.ts)
      token: string; // short-lived access token from that same flow
      dek: Buffer; // already unwrapped/generated via the renderer's master-password step
    }
  | {
      kind: 'mock-remote';
      /** Path to an existing mockServerDbFile to share with another
       * mock-remote profile, simulating "two devices, one account". Omit to
       * have a fresh one generated for this profile alone. No dek -- see
       * MockSyncProvider above, it doesn't encrypt at all. */
      mockServerDbFile?: string;
    };
```

No open questions remain: legacy `store.db` adoption is out of scope (starting fresh, no migration from the old singleton db), the `local`-kind no-op question is resolved by `LocalSyncProvider` holding zero state, and `MockSyncProvider`'s schema question is resolved by giving it one fixed `CREATE TABLE IF NOT EXISTS` schema rather than a versioned migration list.

## File structure

Lands in the existing `src/main/store/` folder, not a new one — this is still sync-persisted state storage, just generalized to be per-profile, so it belongs alongside today's `db.ts`/`settings.ts`/`patches.ts` rather than under a new top-level concept. Flat, no `index.ts`, matching that folder's existing style. No IPC wiring yet — that's a separate, later step once this abstraction is settled. Six files total, four with a colocated `*.test.ts` file, matching this codebase's normal test-colocation convention. `offlineStore.ts` supersedes today's `db.ts`, `migrations.ts`, `settings.ts`, `patches.ts`, `cursor.ts`, and `snapshot.ts`, consolidating all six into one (see its row below); the other five are net-new:

| File                                               | Implements                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `types.ts`                                         | Every shared type from this doc, no logic: `ProfileId`, `ProfileKind`, `ProfileDescriptor` (+ its 3 variants), `ProfileConfig`, `ProfileManifest`, `CreateProfileOptions`, `PendingPatch`, `PushAck`, `RemotePatch`, and the `OfflineStore`/`SyncProvider` interfaces. One file so the provider files can all depend on these shapes without depending on each other.                                                                        |
| `offlineStore.ts` + `offlineStore.test.ts`         | The `OfflineStore` implementation: opens/creates the profile's `node:sqlite` file, runs migrations (the migration array lives here too — consolidates today's `db.ts` + `migrations.ts` + `settings.ts` + `patches.ts` + `cursor.ts` + `snapshot.ts`, six files, into one), `safeStorage`-encrypts every value it stores. Test covers the encrypt/decrypt round-trip and migration idempotency.                                              |
| `syncProvider.ts` + `syncProvider.test.ts`         | `LocalSyncProvider` (holds no state, `push`/`pull` resolve to `[]`) plus `createSyncProvider(descriptor, store, initialConfig?)`, the plain dispatch function that switches on `descriptor.kind` to construct `LocalSyncProvider` / `MockSyncProvider` / `RemoteSyncProvider`. Test covers the switch and `LocalSyncProvider`'s no-op behavior.                                                                                              |
| `mockSyncProvider.ts` + `mockSyncProvider.test.ts` | `MockSyncProvider` — opens its own sqlite file (`mockServerDbFile`) with one fixed, unversioned schema, **no encryption**. Test covers push/pull against that file, including two `MockSyncProvider`s sharing one `mockServerDbFile` to simulate two devices.                                                                                                                                                                                |
| `remoteSyncProvider.ts`                            | `RemoteSyncProvider` — a **stub only**: implements `SyncProvider`, `push()`/`pull()` both `throw new Error('not implemented')`. Real HTTP/PKCE/token-refresh behavior is explicitly out of scope for this pass. No test yet — nothing to test until it's implemented.                                                                                                                                                                        |
| `profileManager.ts` + `profileManager.test.ts`     | The `ProfileManager` interface + implementation: reads/writes `profiles.json` (mirrors `workspaces.ts`'s `readWorkspaces`/`writeWorkspaces`), the `Map<ProfileId, { store: OfflineStore; provider: SyncProvider }>` cache, `ensureDefaultLocalProfile`, and `sync()`'s `OfflineStore` ↔ `SyncProvider` mediation. Test covers create/list/switchProfile/delete plus a full sync round-trip using `LocalSyncProvider` and `MockSyncProvider`. |

## Next steps

This is a design to review — no code changes yet. Once agreed, the next step is implementing the file structure above, starting with `types.ts` and `offlineStore.ts` since everything else composes on top of them, verified incrementally via `npm run typecheck` / the Vitest suites listed above, plus manual exercise of create/switch/delete profile flows in the running app.
