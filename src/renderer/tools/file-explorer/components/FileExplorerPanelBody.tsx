import { Loader2, AlertCircle } from 'lucide-react';
import { Breadcrumb } from './Breadcrumb';
import { FileTable } from './FileTable';
import { FileEntry } from './columns';
import { getParentPath } from '../lib/paths';
import { useDirectoryListing } from '../lib/useDirectoryListing';

interface FileExplorerPanelBodyProps {
  path: string | null;
  onNavigate: (path: string) => void;
  onSelectionChange?: (selected: FileEntry[]) => void;
  onActivate?: () => void;
}

export function FileExplorerPanelBody({
  path,
  onNavigate,
  onSelectionChange,
  onActivate
}: FileExplorerPanelBodyProps) {
  const { entries, status, errorMessage } = useDirectoryListing(path);

  if (path === null) {
    return (
      <div className="flex-1 flex items-center justify-center bg-surface text-text-dim">
        <Loader2 size={20} className="animate-spin" />
      </div>
    );
  }

  const parentPath = getParentPath(path);

  return (
    <div className="flex-1 flex flex-col min-h-0 min-w-0" onMouseDownCapture={onActivate}>
      <Breadcrumb currentPath={path} onNavigate={onNavigate} />

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
              onClick={() => onNavigate(parentPath)}
              className="px-3 py-1.5 rounded-md border border-border hover:bg-surface-3 text-text-base"
            >
              Go Back
            </button>
          )}
        </div>
      )}

      {status === 'ready' && (
        <FileTable
          entries={entries}
          onNavigate={onNavigate}
          onSelectionChange={onSelectionChange}
        />
      )}
    </div>
  );
}
