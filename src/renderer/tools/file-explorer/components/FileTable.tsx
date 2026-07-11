import { useEffect, useMemo, useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  ColumnSizingState
} from '@tanstack/react-table';
import { ListView } from '@renderer/components/ui/ListView';
import { ContextMenu } from '@renderer/components/ui/ContextMenu';
import { Dialog } from '@renderer/components/ui/Dialog';
import { Button } from '@renderer/components/ui/Button';
import { columns, compareEntries, extensionKey, FileEntry, FileRow } from './columns';

// Extensions that open straight into a viewer app and pose no meaningful
// "run something unexpected" risk, so they skip the confirmation prompt.
const DIRECT_OPEN_EXTENSIONS = new Set(['pdf', 'xlsx', 'docx']);

interface FileTableProps {
  entries: FileEntry[];
  onNavigate: (path: string) => void;
  onSelectionChange?: (selected: FileEntry[]) => void;
}

export function FileTable({ entries, onNavigate, onSelectionChange }: FileTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({});
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [iconByKey, setIconByKey] = useState<Record<string, string>>({});
  const [pendingEntry, setPendingEntry] = useState<FileEntry | null>(null);

  useEffect(() => {
    setSelectedPaths(new Set());
    setIconByKey({});

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
  }, [entries]);

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

  return (
    <>
      <ListView
        table={table}
        getRowId={(entry) => entry.path}
        selectedIds={selectedPaths}
        onSelectionChange={setSelectedPaths}
        onRowDoubleClick={activateEntry}
        renderContextMenu={({ row, selectedRows }) => (
          <>
            {selectedRows.length <= 1 && (
              <ContextMenu.Item onClick={() => activateEntry(row)}>
                {row.isDirectory ? 'Open Folder' : 'Open'}
              </ContextMenu.Item>
            )}
            <ContextMenu.Item
              onClick={() => {
                const paths =
                  selectedRows.length > 1 ? selectedRows.map((r) => r.path) : [row.path];
                navigator.clipboard.writeText(paths.join('\n'));
              }}
            >
              Copy Path
            </ContextMenu.Item>
            <ContextMenu.Separator />
            <ContextMenu.Item
              className="text-red-400 data-[highlighted]:text-red-300"
              onClick={() => {
                // Dummy action: no delete IPC exists yet, this is a placeholder.
                const count = Math.max(selectedRows.length, 1);
                console.log(`Delete requested for ${count} item(s)`);
              }}
            >
              Delete {selectedRows.length > 1 ? `${selectedRows.length} items` : ''}
            </ContextMenu.Item>
          </>
        )}
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
    </>
  );
}
