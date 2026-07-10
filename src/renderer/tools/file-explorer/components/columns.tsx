import { ColumnDef } from '@tanstack/react-table';
import { File as FileIcon, Folder } from 'lucide-react';

export interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modifiedMs: number;
  extension: string;
}

export interface FileRow extends FileEntry {
  iconDataUrl?: string;
}

export function compareEntries(a: FileEntry, b: FileEntry): number {
  if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
  return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
}

export function extensionKey(entry: FileEntry): string {
  return entry.extension || `__noext__:${entry.name.toLowerCase()}`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatModified(modifiedMs: number): string {
  return new Date(modifiedMs).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function kindLabel(entry: FileEntry): string {
  if (entry.isDirectory) return 'Folder';
  return entry.extension ? `${entry.extension.toUpperCase()} File` : 'File';
}

export const columns: ColumnDef<FileRow>[] = [
  {
    id: 'name',
    header: 'Name',
    accessorKey: 'name',
    size: 340,
    minSize: 160,
    sortingFn: (rowA, rowB) => compareEntries(rowA.original, rowB.original),
    cell: ({ row }) => {
      const entry = row.original;
      return (
        <div className="flex items-center gap-2 min-w-0">
          {entry.isDirectory ? (
            <Folder className="size-4 text-zinc-500 shrink-0 fill-zinc-500/10" />
          ) : entry.iconDataUrl ? (
            <img src={entry.iconDataUrl} className="size-4 shrink-0" alt="" />
          ) : (
            <FileIcon className="size-4 text-zinc-600 shrink-0" />
          )}
          <span className="truncate font-mono text-zinc-200">{entry.name}</span>
        </div>
      );
    }
  },
  {
    id: 'kind',
    header: 'Kind',
    size: 140,
    minSize: 80,
    accessorFn: (row) => kindLabel(row),
    sortingFn: (rowA, rowB) => kindLabel(rowA.original).localeCompare(kindLabel(rowB.original)),
    cell: ({ row }) => <span className="text-zinc-500">{kindLabel(row.original)}</span>
  },
  {
    id: 'size',
    header: 'Size',
    accessorKey: 'size',
    size: 110,
    minSize: 70,
    cell: ({ row }) => (
      <span className="font-mono text-zinc-450">
        {row.original.isDirectory ? '—' : formatBytes(row.original.size)}
      </span>
    )
  },
  {
    id: 'modified',
    header: 'Modified',
    accessorKey: 'modifiedMs',
    size: 190,
    minSize: 120,
    cell: ({ row }) => (
      <span className="text-zinc-500">{formatModified(row.original.modifiedMs)}</span>
    )
  }
];
