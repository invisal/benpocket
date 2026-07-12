import { useEffect, useRef, useState } from 'react';
import { FileEntry } from '../components/columns';

export type DirectoryListingStatus = 'loading' | 'ready' | 'error';

interface DirectoryListing {
  entries: FileEntry[];
  status: DirectoryListingStatus;
  errorMessage: string;
}

export function useDirectoryListing(
  path: string | null,
  refreshSignal: number = 0
): DirectoryListing {
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [status, setStatus] = useState<DirectoryListingStatus>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const previousPathRef = useRef<string | null>(null);

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

    window.fileExplorer.listDirectory(path).then((res) => {
      if (cancelled) return;
      if ('error' in res) {
        setErrorMessage(res.error);
        setStatus('error');
      } else {
        setEntries(res.entries);
        setStatus('ready');
      }
    });

    return () => {
      cancelled = true;
    };
  }, [path, refreshSignal]);

  return { entries, status, errorMessage };
}
