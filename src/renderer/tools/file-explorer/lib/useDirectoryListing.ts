import { useEffect, useRef, useState } from 'react';
import { type FileEntry } from '../components/columns';
import { getCapabilitiesForLocation } from './capabilities';

export type DirectoryListingStatus = 'loading' | 'ready' | 'error';

interface DirectoryListing {
  entries: FileEntry[];
  status: DirectoryListingStatus;
  errorMessage: string;
}

// External changes (a file dropped in from another app, a git checkout, etc.)
// don't go through dispatchMutation, so they need their own refetch trigger.
const WATCH_DEBOUNCE_MS = 300;

export function useDirectoryListing(
  path: string | null,
  refreshSignal: number = 0
): DirectoryListing {
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [status, setStatus] = useState<DirectoryListingStatus>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [watchTick, setWatchTick] = useState(0);
  const previousPathRef = useRef<string | null>(null);

  useEffect(() => {
    if (path === null || !getCapabilitiesForLocation(path).watchable) return;

    window.fileExplorer.watchDirectory(path);
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const unsubscribe = window.fileExplorer.onWatchEvent((changedPath) => {
      if (changedPath !== path) return;
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => setWatchTick((tick) => tick + 1), WATCH_DEBOUNCE_MS);
    });

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      unsubscribe();
      window.fileExplorer.unwatchDirectory(path);
    };
  }, [path]);

  useEffect(() => {
    if (path === null) return;

    let cancelled = false;
    // Only show the loading state (which unmounts FileTable) when navigating
    // to a genuinely new path. A same-path refresh -- after copy/cut/paste/
    // delete/create -- should swap entries in place instead of flashing a
    // spinner and losing FileTable's scroll position, sort, and selection.
    const isNewPath = previousPathRef.current !== path;
    previousPathRef.current = path;
    if (isNewPath) {
      setStatus('loading');
    }

    (async () => {
      const accumulated: FileEntry[] = [];
      let cursor: string | undefined;
      for (;;) {
        const res = await window.fileExplorer.listDirectory(path, cursor);
        if (cancelled) return;
        if ('error' in res) {
          setErrorMessage(res.error);
          setStatus('error');
          return;
        }
        accumulated.push(...res.entries);
        if (res.nextCursor === null) break;
        cursor = res.nextCursor;
      }
      setEntries(accumulated);
      setStatus('ready');
    })();

    return () => {
      cancelled = true;
    };
  }, [path, refreshSignal, watchTick]);

  return { entries, status, errorMessage };
}
