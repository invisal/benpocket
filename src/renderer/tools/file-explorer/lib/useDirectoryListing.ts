import { useEffect, useState } from 'react';
import { FileEntry } from '../components/columns';

export type DirectoryListingStatus = 'loading' | 'ready' | 'error';

interface DirectoryListing {
  entries: FileEntry[];
  status: DirectoryListingStatus;
  errorMessage: string;
}

export function useDirectoryListing(path: string | null): DirectoryListing {
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [status, setStatus] = useState<DirectoryListingStatus>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (path === null) return;

    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStatus('loading');

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
  }, [path]);

  return { entries, status, errorMessage };
}
