# `usePersistStore` — profile-scoped, Yjs-backed persistence hook

## Context

The profile system (`src/main/store/{types,offlineStore,profileManager,ipc}.ts`, see
`src/main/store/PLAN.md`) already gives every profile its own encrypted sqlite-backed
`OfflineStore` with `appendPatch(key, patch)` / `loadSnapshot(key)`, both delegated by
`ProfileManager` onto whichever profile is currently active. `loadSnapshot` already merges
all stored patches for a key via Yjs's `mergeUpdates` (`src/main/store/offlineStore.ts:126`).
None of this is wired to the renderer yet — `window.profiles` (`src/preload/store/api.ts`)
only covers profile lifecycle (list/switch/create), not doc data.

The ask is a renderer hook, `usePersistStore(key, factory)`, that gives a tool a live Yjs
document backed by that persistence layer:

```ts
const { isLoading, doc } = usePersistStore('settings', () => new Y.Doc());
```

- `doc` is hydrated from the active profile's stored patches (`loadSnapshot`) on load.
- Every local mutation to `doc` is captured as a Yjs update and persisted via `appendPatch`
  for the currently active profile.
- When the active profile changes (`useProfilesStore`'s `activeProfileId`), the hook must
  discard the current doc and reload fresh from the new profile's data — profiles are fully
  isolated, so nothing from the old doc should leak into the new one.

This requires two things: (1) exposing `loadSnapshot`/`appendPatch` over IPC, since they
exist in `ProfileManager` but aren't reachable from the renderer today, and (2) the hook
itself.

## 1. Add `yjs` as an explicit dependency

`src/main/store/offlineStore.ts` already imports `mergeUpdates` from `'yjs'`, but `yjs` is
missing from `package.json` (only present transitively in `node_modules`, currently
`13.6.31`). The renderer will also need it directly (`new Y.Doc()`, `Y.applyUpdate`). Add:

```json
"yjs": "^13.6.31"
```

to `dependencies` in `package.json`. Without this, `knip`/a clean install would flag it.

## 2. IPC: expose doc read/write on the active profile

Reuses the existing `profiles:*` IPC channel and `window.profiles` bridge — no new IPC
namespace. `loadSnapshot`/`appendPatch` are profile-scoped data access, same as everything
else already on `ProfileManager`/`ProfilesApi`.

**`src/main/store/ipc.ts`** — inside `registerProfileHandlers()`, add two handlers next to
the existing `profiles:*` ones, delegating to the same `getProfileManager()`:

```ts
ipcMain.handle('profiles:load-snapshot', (_event, key: string): Promise<Buffer | null> => {
  return getProfileManager().loadSnapshot(key);
});

ipcMain.handle('profiles:append-patch', (_event, key: string, patch: Uint8Array): Promise<void> => {
  return getProfileManager().appendPatch(key, Buffer.from(patch));
});
```

(`patch` arrives from the renderer as a plain `Uint8Array`, not a Node `Buffer` — see below.)

**`src/preload/store/api.ts`** — add the two methods to the existing `ProfilesApi` interface
and `profilesApi` implementation:

```ts
export interface ProfilesApi {
  // ...existing list/getActive/switch/create/pickMockServerFile...
  loadSnapshot: (key: string) => Promise<Uint8Array | null>;
  appendPatch: (key: string, patch: Uint8Array) => Promise<void>;
}

export const profilesApi: ProfilesApi = {
  // ...existing entries...
  loadSnapshot: (key) => ipcRenderer.invoke('profiles:load-snapshot', key),
  appendPatch: (key, patch) => ipcRenderer.invoke('profiles:append-patch', key, patch)
};
```

Typed as `Uint8Array` (not `Buffer`) because `contextBridge` hands the isolated main world
a plain `Uint8Array` — there's no `Buffer` class there. This also matches what
`Y.applyUpdate`/the `doc.on('update', ...)` callback expect directly, no conversion needed
in the hook.

No changes needed to `src/preload/index.ts` or `src/preload/index.d.ts` — `window.profiles`
is already wired up; it just gains two more methods on its existing type.

## 3. The hook: `src/renderer/src/hooks/usePersistStore.ts`

New top-level `hooks/` folder (none exists yet at `renderer/src` today — this is app-wide
infra, not scoped to one tool, unlike the per-tool `tools/<name>/hooks/` convention in
`docs/receipts/tools.md`).

Design:

- Keyed on `[key, activeProfileId]` (`activeProfileId` read from the existing
  `useProfilesStore`, `src/renderer/src/store/profiles.store.ts`). Don't gate on
  `activeProfileId` being non-null — `ProfileManager` always resolves _some_ active profile
  on the main side even before the renderer's `useProfilesStore.load()` has run, so the
  effect can fire immediately on mount with whatever's active. If `activeProfileId` later
  flips from `null` to a real id (once something — today, `ProfileSwitcher` — calls `load()`),
  the effect re-runs and reloads; a harmless one-time extra reload of the same profile's data,
  not a correctness issue.
- Each time the effect (re)runs: build a fresh doc via `factory()`, call `window.profiles.loadSnapshot(key)`,
  apply the result with `Y.applyUpdate(doc, snapshot, LOAD_ORIGIN)` using a sentinel origin.
- Attach `doc.on('update', (update, origin) => { if (origin === LOAD_ORIGIN) return; void window.profiles.appendPatch(key, update); })` — the origin check stops the just-applied
  snapshot from being immediately re-persisted as if it were a new local edit.
- Cleanup: remove the update listener and `doc.destroy()`. Guard the async `loadSnapshot`
  continuation with a `cancelled` flag so a fast key/profile change can't apply a stale
  snapshot onto a doc that's already being torn down.
- `factory` is stored in a ref and always called through the ref, not put in the effect's
  dependency array — so callers can pass an inline arrow (`() => new Y.Doc()`) without it
  retriggering the effect every render.
- Initial synchronous state (`useState`'s lazy initializer) creates one throwaway doc via
  `factory()` purely so `doc` is never `null` on the first render (`isLoading: true`); the
  effect immediately supersedes it with the real, hydrated one before `isLoading` flips to
  `false`. All doc creation/teardown after that point happens inside the effect only — never
  during render — so this stays a pure React effect-owned resource, not a render-phase side
  effect.

```ts
import { useEffect, useRef, useState } from 'react';
import * as Y from 'yjs';
import { useProfilesStore } from '../store/profiles.store';

const LOAD_ORIGIN = Symbol('usePersistStore:load');

export function usePersistStore<T extends Y.Doc = Y.Doc>(
  key: string,
  factory: () => T
): { isLoading: boolean; doc: T } {
  const activeProfileId = useProfilesStore((state) => state.activeProfileId);
  const factoryRef = useRef(factory);
  factoryRef.current = factory;

  const [result, setResult] = useState<{ doc: T; isLoading: boolean }>(() => ({
    doc: factoryRef.current(),
    isLoading: true
  }));

  useEffect(() => {
    const doc = factoryRef.current();
    let cancelled = false;

    function handleUpdate(update: Uint8Array, origin: unknown): void {
      if (origin === LOAD_ORIGIN) return;
      void window.profiles.appendPatch(key, update);
    }

    setResult({ doc, isLoading: true });

    void window.profiles.loadSnapshot(key).then((snapshot) => {
      if (cancelled) return;
      if (snapshot) Y.applyUpdate(doc, snapshot, LOAD_ORIGIN);
      doc.on('update', handleUpdate);
      setResult({ doc, isLoading: false });
    });

    return () => {
      cancelled = true;
      doc.off('update', handleUpdate);
      doc.destroy();
    };
  }, [key, activeProfileId]);

  return result;
}
```

Consumers build their own reactive bindings on top of `doc` (e.g. `doc.getMap('settings')`
plus their own `observe`/`useSyncExternalStore`) — this hook's job stops at "give me a
loaded, auto-persisting `Y.Doc` for the active profile," matching how `OfflineStore`/
`ProfileManager` deliberately stay content-agnostic about what's inside a patch.

## Verification

- `npm run typecheck` / `npm run lint` / `npm run knip` / `npm run format` (per `CLAUDE.md`).
- Existing suites: `src/main/store/{offlineStore,profileManager,syncProvider,mockSyncProvider}.test.ts`
  should be unaffected (no changes to their behavior, only new IPC handlers layered on top of
  already-tested `ProfileManager` methods).
- Manual check in the running app (`npm run dev`): call `usePersistStore` from a throwaway
  spot (e.g. a temporary console log in `ProfileSwitcher` or a scratch component), confirm
  `isLoading` flips to `false` and `doc` round-trips a value across an app restart; then
  switch profiles via the `ProfileSwitcher` UI and confirm the doc's content changes to that
  profile's own (isolated, empty on a fresh profile) data.
