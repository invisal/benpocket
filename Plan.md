# File Explorer: incremental path to S3/R2 support

Goal: support S3/R2-compatible sources alongside the local filesystem, without a
big-bang rewrite. Each step below is small, independently reviewable, and
(except where noted) behavior-preserving for the local driver — so we can
land them one PR at a time and stop at any point with a working app.

## The abstraction: drivers + a declared sync strategy

Each source type (local disk, S3/R2, future: FTP, a mounted network share,
etc.) is a **driver** implementing one `FileDriver` interface — same CRUD
surface (`listDirectory`, `readFile`, `writeFile`, `deleteEntries`,
`copyEntries`, `moveEntries`, `createFile`, `createFolder`).

What differs per driver isn't just _which verbs it supports_ (trash vs.
permanent delete, atomic rename vs. copy+delete) — it's **how the UI's view
of a directory listing stays truthful after something changes**. Today that's
hardcoded into `FileTable`: every mutation calls `bumpRefresh()`, which forces
a full `listDirectory` refetch. That's one specific strategy, not the only
one, and it's a bad fit for a network-billed API like S3.

So `sync` becomes a declared capability with three possible values:

- **`watch`** — the driver can subscribe to native change notifications
  (`fs.watch`/chokidar for local; S3 would need bucket event notifications
  via SQS/EventBridge — real infra, not assumed here). The directory-listing
  hook subscribes per-open-directory and patches `entries` as events arrive,
  including changes that didn't originate from this app. Mutations are
  fire-and-forget; the watch event is the source of truth.
- **`optimistic`** — no watch, and refetching after every op is too slow or
  too expensive to do on every click (S3 bills per request; `ListObjectsV2`
  is a network round trip). The mutation dispatcher predicts the new state
  locally — drops deleted paths, inserts a row for a new file/folder — and
  applies it immediately. The real driver call runs in the background; on
  failure, the patch is rolled back and an error surfaces. No automatic
  refetch; a manual refresh action lets the user force reconciliation.
- **`sync`** — no watch, and optimism isn't warranted (or isn't needed because
  the refetch is cheap). Await the driver call, then force a full refetch.
  This is exactly today's behavior.

`LocalFileDriver` declares `sync` initially — this is a rename/reshape of
what already exists, not a behavior change. `R2FileDriver` (Step 9) declares
`optimistic`. `watch` for local (via `fs.watch`) is a plausible future
upgrade but out of scope here — it's listed to show the abstraction has room
for it, not because we're building it now.

---

## Step 1 — Extract `FileDriver` interface, local-only

**What:** Define the interface the rest of this plan builds on, and refactor
the existing local fs logic in `src/main/file-explorer/index.ts` to implement
it as `LocalFileDriver`. The `ipcMain.handle` callbacks become thin adapters
that call into the driver instance.

```ts
interface FileDriver {
  id: string; // 'local' | 's3' | ...
  capabilities: DriverCapabilities;
  listDirectory(uri: string, cursor?: string): Promise<{ entries: FileEntry[]; nextCursor: string | null } | { error: string }>;
  readFile(uri: string): Promise<...>;
  writeFile(uri: string, content: string): Promise<...>;
  deleteEntries(uris: string[]): Promise<...>;
  copyEntries(sourceUris: string[], destDirUri: string): Promise<...>;
  moveEntries(sourceUris: string[], destDirUri: string): Promise<...>;
  createFile(destDirUri: string, name: string): Promise<...>;
  createFolder(destDirUri: string, name: string): Promise<...>;
}
```

**Why smaller:** Only one implementation exists (local), so this is a pure
extract-method refactor. No IPC contract changes, no renderer changes, no new
concepts (URIs, sync strategy, pagination) introduced yet. Safe to land and
verify nothing regressed before adding any new surface area.

**Files touched:** `src/main/file-explorer/index.ts` only (split into
`index.ts` for `ipcMain` registration + `localFileDriver.ts` for the
implementation).

---

## Step 2 — Add capabilities, including `sync` strategy, to the driver

**What:** Add a `capabilities` object to the interface:

```ts
interface DriverCapabilities {
  trash: boolean; // delete goes to trash vs. permanent
  nativeIcons: boolean; // OS icon lookup available
  atomicMove: boolean; // rename vs. copy+delete
  realFolders: boolean; // folders exist independent of contents
  sync: 'watch' | 'optimistic' | 'sync';
}
```

`LocalFileDriver.capabilities` is `{ trash: true, nativeIcons: true,
atomicMove: true, realFolders: true, sync: 'sync' }` — i.e. today's actual
behavior, just made explicit and declared instead of implicit in
`FileTable`.

**Why smaller:** Zero behavior change, no renderer change yet. This just
gives the properties a name and a place to live before Step 6 makes the
renderer actually read them.

---

## Step 3 — Introduce URI identity for local paths (additive, no scheme change)

**What:** Add a `src/main/file-explorer/location.ts` with a `parseLocation(id: string)`
helper that returns `{ scheme: 'local' | 's3'; ... }`. For now, any string
without an explicit `scheme://` prefix is treated as `scheme: 'local'` and the
rest of the string is the existing OS path — i.e. **local paths keep their
current bare format** (`C:\Users\...`, `/home/...`). No renderer change
required.

**Why smaller:** This is the only step that touches "identity," and it's
deliberately non-breaking: today's bare paths keep working unchanged. It just
gives us a parser ready to recognize `s3://<connectionId>/<bucket>/<key>`
once that scheme exists, without forcing every call site (breadcrumb, store,
`FileTable`'s `getRowId`) to change today.

**Files touched:** new `src/main/file-explorer/location.ts` (+ unit tests).

---

## Step 4 — Driver registry keyed by scheme

**What:** A small registry (`getDriverForLocation(uri): FileDriver`) that
`ipcMain` handlers call instead of using `LocalFileDriver` directly. Only
`local` is registered.

**Why smaller:** Still behavior-identical — there's exactly one branch. This
just moves the "which driver handles this request" decision to one place so
Step 9 is "register a second driver," not "find every call site."

**Files touched:** `src/main/file-explorer/index.ts`.

---

## Step 5 — Make `listDirectory` paginated at the driver contract level

**What:** Change `listDirectory` to accept/return a cursor (already shown in
the Step 1 interface). `LocalFileDriver` always returns `nextCursor: null`
(single page, current behavior). Update `useDirectoryListing` to call
`listDirectory` in a loop until `nextCursor === null`, accumulating into one
array — **UI still receives one flat array, `FileTable` is untouched.**

**Why smaller:** Proves the pagination contract end-to-end without requiring
`FileTable`'s client-side sort/table to change, since local always resolves
in one page. Deferred: pushing cursors into the UI layer itself (see
"Explicitly deferred" below).

**Files touched:** `src/main/file-explorer/index.ts`, `src/preload/file-explorer/api.ts`,
`src/renderer/tools/file-explorer/lib/useDirectoryListing.ts`.

---

## Step 6 — Generic sync-strategy dispatcher in the renderer

**What:** Replace `FileTable`'s hardcoded "call the op, then `bumpRefresh()`"
pattern with a dispatcher that branches on the current location's
`capabilities.sync`:

- `sync` → today's behavior: await the op, then trigger a refetch.
- `optimistic` → apply a predicted patch to `entries` immediately, fire the
  op in the background, roll back + show an error toast on failure.
- `watch` → subscribe to the driver's change stream when the directory opens;
  patch `entries` as events arrive; mutations don't drive refresh directly.

Since `LocalFileDriver` declares `sync`, **this step changes no observable
behavior for local** — it's a refactor of `handleDelete` /
`confirmCreateFile` / `confirmCreateFolder` / `handlePaste` in `FileTable.tsx`
to go through the dispatcher instead of calling `bumpRefresh()` inline, plus
the dispatcher itself (new file, e.g. `src/renderer/tools/file-explorer/lib/syncDispatcher.ts`).
This is the step that makes Step 9 (R2 driver, `optimistic`) "just declare
the capability" instead of requiring UI surgery at the same time.

**Files touched:** `FileTable.tsx`, new `syncDispatcher.ts`,
`fileExplorer.store.ts` (entries patching helpers).

---

## Step 7 — Storage for a single optional global R2 credential (no UI yet)

**What:** Not a list of named "connections" — R2 access here is a single
optional global credential, since it's "whatever this one token is scoped
to see," not something the user enumerates bucket-by-bucket. Main-process-only
storage + IPC:

Four fields, stored together as one credential set (account ID isn't secret,
but the other three are — the API Token, and the R2 Access Key ID/Secret
Access Key pair used for SigV4 against the S3-compatible endpoint):

- `file-explorer:get-r2-credential-status` → `{ configured: boolean }`
  (never returns the secrets themselves — just whether a set is saved, for
  the Settings screen to render "Connected" vs. empty fields)
- `file-explorer:set-r2-credential` →
  `(accountId, apiToken, accessKeyId, secretAccessKey)` → encrypt the three
  secrets with `safeStorage` and write to a small file under
  `app.getPath('userData')`
- `file-explorer:clear-r2-credential` → remove it

All four are required together for R2 to become available — there's no
partial state where only bucket listing or only object browsing works.

When unset, R2 simply doesn't appear as a source anywhere in the UI — it's
opt-in, not an error state.

**Files touched:** new `src/main/file-explorer/r2Credential.ts`,
`src/preload/file-explorer/api.ts`.

---

## Step 8 — Settings screen: add/update/clear the R2 credentials

**What:** A section on the app's homepage/settings area with four inputs —
Cloudflare Account ID, API Token, R2 Access Key ID, R2 Secret Access Key —
plus Save/Update and Clear, calling Step 7's IPC. Purely renderer UI wired to
storage that already exists and is already testable in isolation; doesn't
depend on the driver (Step 9) existing yet.

**Files touched:** wherever the app's settings/homepage UI lives (new
component, e.g. `src/renderer/settings/R2CredentialField.tsx`).

---

## R2 API is split across two SDKs, using two of the four stored credentials each

Cloudflare's R2 API has two surfaces by design, and object browsing needs
both — this is why Step 7/8 collect four fields, not one:

1. **Bucket-level management** (list buckets, create/delete bucket,
   lifecycle rules, CORS, event notifications) — Cloudflare's own REST API,
   wrapped by their official `cloudflare` npm SDK, authenticated with
   `accountId` + `Authorization: Bearer <apiToken>`. Worth having in the
   codebase regardless of R2, since it's the same SDK/token for any other
   Cloudflare product (Workers, DNS, Pages, etc.).
2. **Object-level data operations** — list objects in a bucket, get/put/
   delete/copy object contents, i.e. the actual file-browsing verbs this tool
   needs — are _only_ exposed via R2's S3-compatible endpoint
   (`https://<accountId>.r2.cloudflarestorage.com`), authenticated via AWS
   SigV4 using `accessKeyId` + `secretAccessKey`. Cloudflare deliberately
   didn't build a separate object-level SDK; that surface is S3-compatible on
   purpose so existing S3 tooling works unchanged. This needs
   `@aws-sdk/client-s3`, not the bearer token — not an AWS-lock-in choice,
   it's the only interface that surface offers.

---

## Step 9 — `R2FileDriver`

**What:** Implement the driver interface for R2 using _both_ clients, one
per job: the `cloudflare` SDK (`accountId` + `apiToken`) for bucket
listing/management, `@aws-sdk/client-s3` (`accountId`-derived endpoint +
`accessKeyId` + `secretAccessKey`) for everything inside a bucket.
`listDirectory` uses `ListObjectsV2` with `Delimiter: '/'` to simulate
folders (`CommonPrefixes` = subfolders, `Contents` = files),
`ContinuationToken` translated into the `cursor`/`nextCursor` from Step 5.
Register it in the Step 4 registry under scheme `r2`. Reads the credential
set from Step 7 — never touches the renderer.

**Capabilities declared:**

```ts
{ trash: false, nativeIcons: false, atomicMove: false, realFolders: false, sync: 'optimistic' }
```

`sync: 'optimistic'` because R2 has no push-notification channel we're
building here, and a full refetch after every click is both slow (network
round trip) and billed per request.

**Why this is the first step with real new capability:** everything before
this is scaffolding; this is where R2 actually starts working, but by now
it's additive — dropping into an interface, registry, pagination contract,
and sync dispatcher that already exist and are already exercised by the
local driver.

**Files touched:** new `src/main/file-explorer/r2FileDriver.ts`,
`package.json` (new dependencies: `cloudflare`, `@aws-sdk/client-s3`).

---

## Step 10 — Wire remaining capability flags into the UI

**What:** `FileTable` and friends read `capabilities` for the current
location's driver and adapt:

- No `trash` → delete confirmation says "permanently delete," skips
  trash-specific copy.
- No `nativeIcons` → fall back to extension-based generic icons instead of
  calling `getFileIcon`.
- No `realFolders` → "New Folder" either hidden or clearly labeled as
  creating a placeholder object.

(`sync` was already consumed in Step 6 — this step is the remaining four
flags.)

**Files touched:** `FileTable.tsx`, `columns.tsx`, `FileExplorerPanelBody.tsx`.

---

## Step 11 — Sidebar surfaces R2

**What:** `getSidebarSections` adds a single "R2" section when
`get-r2-credential-status` reports `configured: true` (nothing shown
otherwise). Its children are populated by listing the buckets the token can
see — bucket-list is a Cloudflare REST API call regardless of how Step 9's
open question resolved, since that part of the native API is not in
question. Clicking a bucket navigates to its `r2://bucket/` root.

**Files touched:** `src/main/file-explorer/index.ts`,
`FileExplorerSidebar.tsx`.

---

## Explicitly deferred (not in this plan)

- **UI-level virtualized/cursor pagination in `FileTable`.** Only worth doing
  if real usage shows buckets large enough (tens of thousands of keys+) that
  fully draining pagination server-side before returning is too slow. Revisit
  after Step 8 ships and we have real bucket sizes to look at.
- **`watch` for `LocalFileDriver` via `fs.watch`/chokidar.** The abstraction
  supports it (Step 2), but it's a separate enhancement (catches external
  changes made outside the app) with its own edge cases (debouncing, network
  drives) — not needed to ship S3 support.
- **`watch` for S3 via bucket event notifications (SQS/EventBridge).** Real
  infra dependency; only worth it if multi-client concurrent editing of the
  same bucket turns out to matter.
- **Multi-account / cross-connection search.**
- **Conflict resolution UI for concurrent edits on remote objects** (no
  file-locking equivalent on S3) — `optimistic` sync's rollback-on-failure
  handles the single-client case but not two clients racing.

---

## Suggested landing order / sizing

Steps 1–6 are pure refactor of the existing local-only code path — no new
runtime behavior, safe to land back-to-back with normal review. Step 7 is new
but isolated (no UI). Step 8 is the first step that adds real S3/R2 behavior.
Steps 9–10 are UI polish once Step 8 is in.
