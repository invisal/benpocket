import { useEffect, useMemo, useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  ColumnSizingState
} from '@tanstack/react-table';
import { ListView } from '@renderer/components/ui/ListView';
import { columns, compareEntries, extensionKey, FileEntry, FileRow } from './columns';

interface FileTableProps {
  entries: FileEntry[];
  onNavigate: (path: string) => void;
}

export function FileTable({ entries, onNavigate }: FileTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({});
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [iconByKey, setIconByKey] = useState<Record<string, string>>({});

  useEffect(() => {
    setSelectedPath(null);
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

  return (
    <ListView
      table={table}
      getRowId={(entry) => entry.path}
      isRowSelected={(entry) => selectedPath === entry.path}
      onRowClick={(entry) => setSelectedPath(entry.path)}
      onRowDoubleClick={(entry) => {
        if (entry.isDirectory) {
          onNavigate(entry.path);
        } else {
          window.fileExplorer.openPath(entry.path);
        }
      }}
      emptyState={
        <div className="flex-1 flex items-center justify-center text-text-dim text-xs">
          This folder is empty
        </div>
      }
    />
  );
}
