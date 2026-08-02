# usePersistStore

`src/renderer/src/hooks/usePersistStore.ts`

Use this when you want to share state and have it sync across devices on a shared
profile (via the profile's `SyncProvider`). It's built on top of [Yjs](https://docs.yjs.dev/)
-- persistence, hydration, and merging of remote changes are all handled for you:

- Loads the doc's snapshot on mount and whenever `key` or the active profile changes.
- Every local mutation to the doc is auto-persisted (`window.profiles.appendPatch`).
- Remote changes pulled in by a `sync()` elsewhere in the app are merged into the same
  live doc, so open components stay in sync without a remount.

Not for one-off local UI state -- use `useState` / a zustand store for that.

## The doc is not reactive

`usePersistStore` does not re-render your component when the doc's content changes --
neither from a local mutation nor a merged remote one. You have to observe the Yjs type
yourself (e.g. `map.observe(...)`) and put the result in `useState` to get re-renders.

## Usage

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

## Naming the key

`key` is a flat identifier stored per-profile (not namespaced per tool), so it must be
unique across the whole app. Prefix it with the tool name to avoid collisions, e.g.
`kuberneter/favorites`, `http-client/collections`.

See `PersistStoreGallery` (`src/renderer/tools/storybook/components/PersistStoreGallery.tsx`)
for a full working example.
