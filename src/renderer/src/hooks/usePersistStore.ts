import { useEffect, useRef, useState } from 'react';
import * as Y from 'yjs';
import { useProfilesStore } from '../store/profiles.store';

// Tags the transaction that replays a loaded snapshot back into the doc, so
// the update listener below can tell "just hydrated from storage" apart from
// a genuine local edit and avoid re-persisting the snapshot it just read.
const LOAD_ORIGIN = Symbol('usePersistStore:load');

interface UsePersistStoreResult<T extends Y.Doc> {
  isLoading: boolean;
  doc: T;
}

/**
 * A Yjs doc for `key`, scoped to the active profile (see
 * src/main/store/profileManager.ts) -- hydrated from `window.profiles.loadSnapshot`
 * on load/profile change, with every local update auto-persisted via
 * `window.profiles.appendPatch`.
 */
export function usePersistStore<T extends Y.Doc = Y.Doc>(
  key: string,
  factory: () => T
): UsePersistStoreResult<T> {
  const activeProfileId = useProfilesStore((state) => state.activeProfileId);
  const factoryRef = useRef(factory);

  // Keeps factoryRef current without mutating it during render (not allowed
  // by the React Compiler) -- runs after every render, so by the time the
  // load effect below next fires (key/profile change), the ref already
  // reflects that render's factory closure.
  useEffect(() => {
    factoryRef.current = factory;
  });

  const [result, setResult] = useState<UsePersistStoreResult<T>>(() => ({
    doc: factory(),
    isLoading: true
  }));

  useEffect(() => {
    const doc = factoryRef.current();
    let cancelled = false;

    function handleUpdate(update: Uint8Array, origin: unknown): void {
      if (origin === LOAD_ORIGIN) return;
      // The status bar's unpushed count updates itself via a push from main
      // (see src/renderer/src/store/sync.store.ts) -- no need to poke it here.
      void window.profiles.appendPatch(key, update);
    }

    setResult({ doc, isLoading: true });

    void window.profiles
      .loadSnapshot(key)
      .then((snapshot) => {
        if (cancelled || !snapshot) return;
        Y.applyUpdate(doc, snapshot, LOAD_ORIGIN);
      })
      // Consumers gate their Yjs observers on isLoading, so leaving it stuck
      // true silently freezes their UI at whatever defaults it first rendered
      // -- edits appear to do nothing. Start from an empty doc instead: the
      // failure is loud in the console and new edits still persist.
      .catch((err: unknown) => {
        console.error(`Could not load persisted doc "${key}".`, err);
      })
      .finally(() => {
        if (cancelled) return;
        doc.on('update', handleUpdate);
        setResult({ doc, isLoading: false });
      });

    return () => {
      cancelled = true;
      doc.off('update', handleUpdate);
      doc.destroy();
    };
  }, [key, activeProfileId]);

  // Merges in remote changes pulled by a sync() elsewhere (see
  // src/main/store/ipc.ts's broadcastDocsChanged) into this same live doc --
  // deliberately independent of the load/teardown effect above so it doesn't
  // reset isLoading or the doc identity, just the doc's content. Re-applying
  // the merged snapshot is safe even for state this doc already has (Yjs
  // updates are idempotent), and reusing LOAD_ORIGIN keeps it from bouncing
  // back out through the update listener above as a fresh local edit.
  useEffect(() => {
    return window.profiles.onDocsChanged((changedKeys) => {
      if (!changedKeys.includes(key)) return;
      void window.profiles.loadSnapshot(key).then((snapshot) => {
        if (snapshot) Y.applyUpdate(result.doc, snapshot, LOAD_ORIGIN);
      });
    });
  }, [key, result.doc]);

  return result;
}
