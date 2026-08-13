# Sync Store

`src/main/store/` (main process) / `src/renderer/src/hooks/usePersistStore.ts` (renderer)

Use this when you want to share state and have it sync across devices on a shared
profile (via the profile's `SyncProvider`). It's built on top of [Yjs](https://docs.yjs.dev/)
-- persistence, hydration, and merging of remote changes are all handled for you:

- Loads the doc's snapshot on first read and whenever `key` or the active profile changes.
- Every local mutation to the doc is auto-persisted.
- Remote changes pulled in by a `sync()` elsewhere in the app are merged into the same
  doc, so anything reading it afterwards sees them.
- **Performance:** both processes read/write local SQLite (`node:sqlite` + `safeStorage`) --
  no network round trip, so reads/writes are very fast even at keystroke-level frequency.
- **Limitation:** each doc's merged snapshot is capped at **2MB** per `key` -- the remote
  backend stores it in a Cloudflare Durable Object's SQLite storage, which caps a stored
  value at 2MB per row. Not enforced locally, but a local-only doc over 2MB will fail to
  sync once that profile connects to a remote. Keep docs to structured data (settings,
  small lists) -- not blobs like screenshots or file contents.

Not for one-off local UI state -- use `useState` / a zustand store for that.

There are two ways to read/write a doc, depending on which process you're in.

## 1. Renderer process: `usePersistStore`

```tsx
const { isLoading, doc } = usePersistStore(key, () => new Y.Doc());
```

- Loads the doc's snapshot on mount and whenever `key` or the active profile changes.
- Every local mutation to the doc is auto-persisted (`window.profiles.appendPatch`).
- Remote changes pulled in by a `sync()` elsewhere in the app are merged into the same
  live doc, so open components stay in sync without a remount.

### The doc is not reactive

`usePersistStore` does not re-render your component when the doc's content changes --
neither from a local mutation nor a merged remote one. You have to observe the Yjs type
yourself (e.g. `map.observe(...)`) and put the result in `useState` to get re-renders.
There are two ways to do that:

### Raw `Y.Doc` access

Call the hook directly and observe the Yjs type yourself. Full Yjs API (maps, arrays,
nested types), so reach for this when the store holds a collection rather than a flat
bag of fields:

```tsx
const DOC_KEY = 'my-tool/settings';

function MyToolPanel() {
  const { isLoading, doc } = usePersistStore(DOC_KEY, () => new Y.Doc());
  const map = doc.getMap<string>(DOC_KEY);
  const [entries, setEntries] = useState(() => Array.from(map.entries()));

  useEffect(() => {
    const sync = () => setEntries(Array.from(map.entries()));
    sync();
    map.observe(sync);
    return () => map.unobserve(sync);
  }, [map]);

  // entries is now live: reflects local edits, remote syncs, and profile switches
}
```

`factory` builds the `Y.Doc` (called once per `key`/profile change); it doesn't need to
be memoized. `isLoading` is `true` until the initial snapshot load resolves -- guard
mutations on it if the doc must be empty-but-hydrated before writes are safe.

See `PersistStoreGallery` (`src/renderer/tools/storybook/components/PersistStoreGallery.tsx`)
for a full working example.

### Wrapped fields hook

For a flat settings-shaped doc, wrap `usePersistStore` in a small tool-specific hook that
exposes plain fields + a `setFields` patcher instead of raw Yjs `Map` calls. This is the
pattern to copy for any new settings panel -- see `useCloudflareSettings`
(`src/renderer/src/hooks/useCloudflareSettings.ts`) and `useScreenCaptureSettings`
(`src/renderer/tools/screen-capture/lib/use-screen-capture-settings.ts`):

```tsx
function readFields(map: Y.Map<unknown>): MyFields {
  return { foo: (map.get('foo') as string | undefined) ?? '' };
}

export function useMyToolSettings() {
  const { isLoading, doc } = usePersistStore(MY_KEY, () => new Y.Doc());
  const map = doc.getMap<unknown>(MY_KEY);
  const [fields, setFieldsState] = useState(() => readFields(map));

  useEffect(() => {
    const sync = () => setFieldsState(readFields(map));
    sync();
    map.observe(sync);
    return () => map.unobserve(sync);
  }, [map]);

  const setFields = (patch: Partial<MyFields>) => {
    doc.transact(() => {
      for (const [key, value] of Object.entries(patch)) map.set(key, value);
    });
  };

  return { isLoading, fields, setFields };
}
```

Consumers get a plain object and a setter -- no Yjs types leak past the hook.

## 2. Main process: a `getXSettings()` reader

The hook is renderer-only (it's built on React state/effects). Main-process code that
needs the same data -- e.g. `r2FileDriver.ts` or `agent/client.ts` reading Cloudflare
credentials -- doesn't use a hook at all. Instead there's a plain async function that
reads the doc on demand. `getCloudflareSettings()`
(`src/main/store/cloudflareSettings.ts`) is the pattern to copy:

```ts
export async function getCloudflareSettings(): Promise<CloudflareSettings | null> {
  const snapshot = await getProfileManager().loadSnapshot(CLOUDFLARE_SETTINGS_KEY);
  if (!snapshot) return null;

  const doc = new Y.Doc();
  Y.applyUpdate(doc, snapshot);
  const map = doc.getMap<unknown>(CLOUDFLARE_SETTINGS_KEY);

  const accountId = map.get('accountId');
  const apiToken = map.get('apiToken');
  if (typeof accountId !== 'string' || !accountId || typeof apiToken !== 'string' || !apiToken) {
    return null;
  }
  // ...read the rest of the fields off `map`, same key names the renderer hook uses
  return { accountId, apiToken /* ... */ };
}
```

How it works, step by step:

1. `getProfileManager()` (`src/main/store/ipc.ts`) hands back the same in-process
   `ProfileManager` the `profiles:*` IPC handlers use -- so this is a direct call, not an
   IPC round trip. `.loadSnapshot(key)` returns the merged doc as a raw `Buffer | null`
   straight from the active profile's `OfflineStore` (SQLite + `safeStorage`).
2. A fresh, throwaway `Y.Doc` is created and the snapshot applied to it with
   `Y.applyUpdate`. This doc only exists for the duration of the function call --
   nothing keeps it alive or observes it afterwards.
3. Fields are read off the doc's `Y.Map` with the *same key names* the renderer's
   `usePersistStore`-based hook uses for that doc (`CLOUDFLARE_SETTINGS_KEY` here), so
   the two sides agree on shape without sharing code.
4. It returns a plain typed object (or `null` if required fields aren't set yet) instead
   of the raw Yjs map, same spirit as the renderer's wrapped-fields hooks.

Not cached -- every call re-reads and re-merges. `loadSnapshot` is a cheap local SQLite
read plus a Yjs merge, so that's deliberate: it sidesteps cache invalidation across
profile switches/syncs instead of trying to track when the cached value goes stale.

`getProfileManager().appendPatch(key, patch)` is the write-side counterpart, if a
main-process function ever needs to write instead of just read. One gotcha: calling it
this way bypasses the unpushed-count and `onDocsChanged` pushes to renderer windows --
those live in the `profiles:append-patch` IPC handler (`src/main/store/ipc.ts`), not in
`ProfileManager` itself. Fine for main-process-only writes; if a renderer window also has
that key open live, it won't pick up the change until it re-syncs.

## Naming the key

`key` is a flat identifier stored per-profile (not namespaced per tool), so it must be
unique across the whole app. Prefix it with the tool name to avoid collisions, e.g.
`kuberneter/favorites`, `http-client/collections`. When a key is shared between a
renderer hook and a main-process reader (like `cloudflare/settings` above), define the
key constant once and import it from both sides rather than duplicating the string.
