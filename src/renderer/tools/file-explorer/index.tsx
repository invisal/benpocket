import { useEffect, useState } from 'react';
import { ToolComponentProps } from '@renderer/components/providers/createTabProvider';
import { Loader2, AlertCircle } from 'lucide-react';
import { Breadcrumb } from './components/Breadcrumb';
import { getParentPath } from './lib/paths';
import { FileTable } from './components/FileTable';
import { FileEntry } from './components/columns';

interface Props {}

// eslint-disable-next-line no-empty-pattern
export function FileExplorerMain({}: ToolComponentProps<Props>) {
  const [currentPath, setCurrentPath] = useState<string | null>(null);
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    window.fileExplorer.getHomeDir().then(setCurrentPath);
  }, []);

  useEffect(() => {
    if (currentPath === null) return;

    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStatus('loading');

    window.fileExplorer.listDirectory(currentPath).then((res) => {
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
  }, [currentPath]);

  if (currentPath === null) {
    return (
      <div className="flex-1 flex items-center justify-center bg-surface text-text-dim">
        <Loader2 size={20} className="animate-spin" />
      </div>
    );
  }

  const parentPath = getParentPath(currentPath);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-surface">
      <Breadcrumb currentPath={currentPath} onNavigate={setCurrentPath} />

      {status === 'loading' && (
        <div className="flex-1 flex items-center justify-center text-text-dim">
          <Loader2 size={20} className="animate-spin" />
        </div>
      )}

      {status === 'error' && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-text-dim text-xs px-4 text-center">
          <AlertCircle size={20} className="text-red-500" />
          <span>Cannot access this folder: {errorMessage}</span>
          {parentPath && (
            <button
              onClick={() => setCurrentPath(parentPath)}
              className="px-3 py-1.5 rounded-md border border-border hover:bg-surface-3 text-text-base"
            >
              Go Back
            </button>
          )}
        </div>
      )}

      {status === 'ready' && <FileTable entries={entries} onNavigate={setCurrentPath} />}
    </div>
  );
}

export default FileExplorerMain;
