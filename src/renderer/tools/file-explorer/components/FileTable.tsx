import { useEffect, useMemo, useRef, useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  type ColumnSizingState
} from '@tanstack/react-table';
import { FileText, FolderPlus } from 'lucide-react';
import { ListView } from '@renderer/components/ui/ListView';
import { ContextMenu } from '@renderer/components/ui/ContextMenu';
import { Dialog } from '@renderer/components/ui/Dialog';
import { Button } from '@renderer/components/ui/Button';
import { Input } from '@renderer/components/ui/Input';
import { columns, compareEntries, extensionKey, type FileEntry, type FileRow } from './columns';
import { useFileExplorerStore } from '../store/fileExplorer.store';
import { dispatchMutation } from '../lib/syncDispatcher';
import { getCapabilitiesForLocation } from '../lib/capabilities';

const DEFAULT_NEW_TEXT_FILE_NAME = 'New Text Document.txt';
const DEFAULT_NEW_FOLDER_NAME = 'New Folder';

// Extensions that open straight into a viewer app and pose no meaningful
// "run something unexpected" risk, so they skip the confirmation prompt.
const DIRECT_OPEN_EXTENSIONS = new Set(['pdf', 'xlsx', 'docx']);

interface FileTableProps {
  entries: FileEntry[];
  currentPath: string;
  onNavigate: (path: string) => void;
  onSelectionChange?: (selected: FileEntry[]) => void;
}

export function FileTable({ entries, currentPath, onNavigate, onSelectionChange }: FileTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({});
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [iconByKey, setIconByKey] = useState<Record<string, string>>({});
  const [pendingEntry, setPendingEntry] = useState<FileEntry | null>(null);
  const [newFileDialogOpen, setNewFileDialogOpen] = useState(false);
  const [newFileName, setNewFileName] = useState(DEFAULT_NEW_TEXT_FILE_NAME);
  const [newFileError, setNewFileError] = useState<string | null>(null);
  const newFileInputRef = useRef<HTMLInputElement>(null);
  const [newFolderDialogOpen, setNewFolderDialogOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState(DEFAULT_NEW_FOLDER_NAME);
  const [newFolderError, setNewFolderError] = useState<string | null>(null);
  const newFolderInputRef = useRef<HTMLInputElement>(null);
  const [pendingDeletePaths, setPendingDeletePaths] = useState<string[] | null>(null);
  const capabilities = getCapabilitiesForLocation(currentPath);
  const clipboard = useFileExplorerStore((s) => s.clipboard);
  const setClipboard = useFileExplorerStore((s) => s.setClipboard);
  const bumpRefresh = useFileExplorerStore((s) => s.bumpRefresh);
  // Set right before a delete/create-triggered refresh so the entries-changed
  // effect below selects the resulting row instead of clearing the selection:
  // 'first' selects the first remaining row (after a delete), a path string
  // selects that specific row (after creating a new file).
  const pendingSelectionRef = useRef<string | 'first' | null>(null);

  useEffect(() => {
    const pending = pendingSelectionRef.current;
    pendingSelectionRef.current = null;
    if (pending === 'first') {
      const first = [...entries].sort(compareEntries)[0];
      setSelectedPaths(first ? new Set([first.path]) : new Set());
    } else if (pending) {
      setSelectedPaths(
        entries.some((entry) => entry.path === pending) ? new Set([pending]) : new Set()
      );
    } else {
      setSelectedPaths(new Set());
    }
    setIconByKey({});

    // No native icon lookup for this location (e.g. R2) -- columns.tsx already
    // falls back to an extension-based generic icon when iconByKey has nothing.
    if (!capabilities.nativeIcons) return;

    const uniqueFiles = new Map<string, FileEntry>();
    for (const entry of entries) {
      if (entry.isDirectory) continue;
      const key = extensionKey(entry);
      if (!uniqueFiles.has(key)) uniqueFiles.set(key, entry);
    }

    let cancelled = false;
    uniqueFiles.forEach((entry, key) => {
      window.fileExplorer.getFileIcon(entry.path, entry.extension).then((dataUrl) => {
        if (cancelled || !dataUrl) return;
        setIconByKey((prev) => (prev[key] ? prev : { ...prev, [key]: dataUrl }));
      });
    });

    return () => {
      cancelled = true;
    };
  }, [entries, capabilities.nativeIcons]);

  useEffect(() => {
    if (!newFileDialogOpen) return;
    const input = newFileInputRef.current;
    if (!input) return;
    input.focus();
    // Select just the name portion (not the extension), matching Explorer/
    // Finder's "New Text Document.txt" rename-ready behavior.
    const dotIndex = newFileName.lastIndexOf('.');
    input.setSelectionRange(0, dotIndex > 0 ? dotIndex : newFileName.length);
    // Only re-run when the dialog opens, not on every keystroke of newFileName.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newFileDialogOpen]);

  useEffect(() => {
    if (!newFolderDialogOpen) return;
    const input = newFolderInputRef.current;
    if (!input) return;
    input.focus();
    input.select();
  }, [newFolderDialogOpen]);

  const rows: FileRow[] = useMemo(
    () =>
      [...entries]
        .sort(compareEntries)
        .map((entry) => ({ ...entry, iconDataUrl: iconByKey[extensionKey(entry)] })),
    [entries, iconByKey]
  );

  useEffect(() => {
    onSelectionChange?.(entries.filter((entry) => selectedPaths.has(entry.path)));
  }, [selectedPaths, entries, onSelectionChange]);

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table memoizes its own return value; not a React Compiler concern
  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting, columnSizing },
    onSortingChange: setSorting,
    onColumnSizingChange: setColumnSizing,
    columnResizeMode: 'onChange',
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel()
  });

  const activateEntry = (entry: FileEntry) => {
    if (entry.isDirectory) {
      onNavigate(entry.path);
    } else if (DIRECT_OPEN_EXTENSIONS.has(entry.extension)) {
      window.fileExplorer.openPath(entry.path);
    } else {
      setPendingEntry(entry);
    }
  };

  const confirmOpen = () => {
    if (pendingEntry) window.fileExplorer.openPath(pendingEntry.path);
    setPendingEntry(null);
  };

  const selectedEntries = useMemo(
    () => entries.filter((entry) => selectedPaths.has(entry.path)),
    [entries, selectedPaths]
  );

  const handleCopy = (paths: string[]) => {
    if (paths.length === 0) return;
    setClipboard({ paths, mode: 'copy' });
    window.fileExplorer.writeClipboardFiles(paths, 'copy');
  };

  const handleCut = (paths: string[]) => {
    if (paths.length === 0) return;
    setClipboard({ paths, mode: 'cut' });
    window.fileExplorer.writeClipboardFiles(paths, 'cut');
  };

  const handlePaste = async () => {
    const files = await window.fileExplorer.readClipboardFiles();
    if (!files || files.paths.length === 0) return;

    await dispatchMutation({
      locationUri: currentPath,
      run: () =>
        files.mode === 'cut'
          ? window.fileExplorer.moveEntries(files.paths, currentPath)
          : window.fileExplorer.copyEntries(files.paths, currentPath),
      onSuccess: () => {
        if (files.mode === 'cut') setClipboard(null);
      },
      onRefetch: bumpRefresh
    });
  };

  const runDelete = (paths: string[]) => {
    void dispatchMutation({
      locationUri: currentPath,
      run: () => window.fileExplorer.deleteEntries(paths),
      onSuccess: () => {
        pendingSelectionRef.current = 'first';
      },
      onRefetch: bumpRefresh
    });
  };

  const handleDelete = (paths: string[]) => {
    if (paths.length === 0) return;
    // No trash for this location -- deletion is permanent, so confirm first
    // instead of firing it immediately like the recoverable-trash path does.
    if (!capabilities.trash) {
      setPendingDeletePaths(paths);
      return;
    }
    runDelete(paths);
  };

  const confirmDelete = () => {
    if (pendingDeletePaths) runDelete(pendingDeletePaths);
    setPendingDeletePaths(null);
  };

  const openNewFileDialog = () => {
    setNewFileName(DEFAULT_NEW_TEXT_FILE_NAME);
    setNewFileError(null);
    setNewFileDialogOpen(true);
  };

  const confirmCreateFile = async () => {
    const name = newFileName.trim();
    if (!name) {
      setNewFileError('Enter a file name.');
      return;
    }

    await dispatchMutation<{ path: string }>({
      locationUri: currentPath,
      run: () => window.fileExplorer.createFile(currentPath, name),
      onSuccess: (result) => {
        pendingSelectionRef.current = result.path;
        setNewFileDialogOpen(false);
      },
      onError: (message) => {
        setNewFileError(message === 'exists' ? 'A file with this name already exists.' : message);
      },
      onRefetch: bumpRefresh
    });
  };

  const openNewFolderDialog = () => {
    setNewFolderName(DEFAULT_NEW_FOLDER_NAME);
    setNewFolderError(null);
    setNewFolderDialogOpen(true);
  };

  const confirmCreateFolder = async () => {
    const name = newFolderName.trim();
    if (!name) {
      setNewFolderError('Enter a folder name.');
      return;
    }

    await dispatchMutation<{ path: string }>({
      locationUri: currentPath,
      run: () => window.fileExplorer.createFolder(currentPath, name),
      onSuccess: (result) => {
        pendingSelectionRef.current = result.path;
        setNewFolderDialogOpen(false);
      },
      onError: (message) => {
        setNewFolderError(
          message === 'exists' ? 'A folder with this name already exists.' : message
        );
      },
      onRefetch: bumpRefresh
    });
  };

  // Shared between the row and background context menus.
  const newSubmenu = (
    <ContextMenu.SubmenuRoot>
      <ContextMenu.SubmenuTrigger>New</ContextMenu.SubmenuTrigger>
      <ContextMenu.Content>
        <ContextMenu.Item onClick={openNewFolderDialog}>
          <span className="flex items-center gap-2">
            <FolderPlus size={14} className="text-text-dim" />
            {capabilities.realFolders ? 'Folder' : 'Folder (placeholder)'}
          </span>
        </ContextMenu.Item>
        <ContextMenu.Item onClick={openNewFileDialog}>
          <span className="flex items-center gap-2">
            <FileText size={14} className="text-text-dim" />
            Text File
          </span>
        </ContextMenu.Item>
      </ContextMenu.Content>
    </ContextMenu.SubmenuRoot>
  );

  return (
    <>
      <ListView
        table={table}
        getRowId={(entry) => entry.path}
        selectedIds={selectedPaths}
        onSelectionChange={setSelectedPaths}
        onRowDoubleClick={activateEntry}
        onCopy={() => handleCopy(selectedEntries.map((entry) => entry.path))}
        onCut={() => handleCut(selectedEntries.map((entry) => entry.path))}
        onPaste={handlePaste}
        onDelete={() => handleDelete(selectedEntries.map((entry) => entry.path))}
        renderContextMenu={({ row, selectedRows }) => {
          if (!row) {
            return (
              <>
                {newSubmenu}
                <ContextMenu.Item onClick={handlePaste} disabled={!clipboard} shortcut="mod+v">
                  Paste
                </ContextMenu.Item>
              </>
            );
          }

          const paths = selectedRows.length > 1 ? selectedRows.map((r) => r.path) : [row.path];
          return (
            <>
              {selectedRows.length <= 1 && (
                <ContextMenu.Item onClick={() => activateEntry(row)}>
                  {row.isDirectory ? 'Open Folder' : 'Open'}
                </ContextMenu.Item>
              )}
              <ContextMenu.Item onClick={() => handleCopy(paths)} shortcut="mod+c">
                Copy
              </ContextMenu.Item>
              <ContextMenu.Item onClick={() => handleCut(paths)} shortcut="mod+x">
                Cut
              </ContextMenu.Item>
              <ContextMenu.Item onClick={handlePaste} disabled={!clipboard} shortcut="mod+v">
                Paste
              </ContextMenu.Item>
              {newSubmenu}
              <ContextMenu.Item onClick={() => navigator.clipboard.writeText(paths.join('\n'))}>
                Copy Path
              </ContextMenu.Item>
              <ContextMenu.Separator />
              <ContextMenu.Item
                className="text-red-400 data-[highlighted]:text-red-300"
                onClick={() => handleDelete(paths)}
                shortcut="delete"
              >
                Delete {selectedRows.length > 1 ? `${selectedRows.length} items` : ''}
              </ContextMenu.Item>
            </>
          );
        }}
        emptyState={
          <div className="flex-1 flex items-center justify-center text-text-dim text-xs">
            This folder is empty
          </div>
        }
      />
      <Dialog.Root
        open={pendingEntry !== null}
        onOpenChange={(open) => !open && setPendingEntry(null)}
      >
        <Dialog.Content className="max-w-sm">
          <Dialog.Title>Run this file?</Dialog.Title>
          <Dialog.Description>
            {pendingEntry?.name} will be opened with its default application. Only continue if you
            trust this file.
          </Dialog.Description>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setPendingEntry(null)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={confirmOpen}>
              Run
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Root>
      <Dialog.Root
        open={newFileDialogOpen}
        onOpenChange={(open) => !open && setNewFileDialogOpen(false)}
      >
        <Dialog.Content className="max-w-sm">
          <Dialog.Title>New Text File</Dialog.Title>
          <Dialog.Description>Enter a name for the new file.</Dialog.Description>
          <Input
            ref={newFileInputRef}
            className="mt-3"
            value={newFileName}
            onChange={(e) => {
              setNewFileName(e.target.value);
              setNewFileError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                confirmCreateFile();
              }
            }}
          />
          {newFileError && <p className="mt-1.5 text-xs text-red-400">{newFileError}</p>}
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setNewFileDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={confirmCreateFile}>
              Create
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Root>
      <Dialog.Root
        open={newFolderDialogOpen}
        onOpenChange={(open) => !open && setNewFolderDialogOpen(false)}
      >
        <Dialog.Content className="max-w-sm">
          <Dialog.Title>New Folder</Dialog.Title>
          <Dialog.Description>
            {capabilities.realFolders
              ? 'Enter a name for the new folder.'
              : "This location doesn't have real folders -- this creates a placeholder object that behaves like one."}
          </Dialog.Description>
          <Input
            ref={newFolderInputRef}
            className="mt-3"
            value={newFolderName}
            onChange={(e) => {
              setNewFolderName(e.target.value);
              setNewFolderError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                confirmCreateFolder();
              }
            }}
          />
          {newFolderError && <p className="mt-1.5 text-xs text-red-400">{newFolderError}</p>}
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setNewFolderDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={confirmCreateFolder}>
              Create
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Root>
      <Dialog.Root
        open={pendingDeletePaths !== null}
        onOpenChange={(open) => !open && setPendingDeletePaths(null)}
      >
        <Dialog.Content className="max-w-sm">
          <Dialog.Title>Permanently delete?</Dialog.Title>
          <Dialog.Description>
            {pendingDeletePaths && pendingDeletePaths.length > 1
              ? `${pendingDeletePaths.length} items`
              : 'This item'}{' '}
            will be permanently deleted. This can&apos;t be undone.
          </Dialog.Description>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setPendingDeletePaths(null)}>
              Cancel
            </Button>
            <Button variant="destructive" size="sm" onClick={confirmDelete}>
              Delete
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Root>
    </>
  );
}
