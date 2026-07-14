// Preview policy shared by every driver's readFile/writeFile: which extensions
// FilePreview can open, and how large a file it'll pull into memory to do so.
export const PREVIEWABLE_EXTENSIONS = new Set(['txt', 'md', 'json', 'ini']);
export const MAX_PREVIEW_FILE_BYTES = 5 * 1024 * 1024;

export interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modifiedMs: number;
  extension: string;
}

export type ListDirectoryResult =
  { entries: FileEntry[]; nextCursor: string | null } | { error: string };

export type ReadFileResult =
  | { content: string }
  | { error: 'too-large'; maxBytes: number }
  | { error: 'unsupported-extension' }
  | { error: string };

export type WriteFileResult = { success: true } | { error: string };

export type MutationResult = { success: true } | { error: string };

export type CreateResult =
  { success: true; path: string } | { error: 'exists' } | { error: string };

export interface DriverCapabilities {
  /** Delete goes to a recoverable trash vs. permanent removal. */
  trash: boolean;
  /** OS icon lookup (`app.getFileIcon`) is available for this source. */
  nativeIcons: boolean;
  /** Rename/move is a single atomic operation vs. copy+delete. */
  atomicMove: boolean;
  /** Folders exist as entries independent of their contents (vs. simulated via key prefixes). */
  realFolders: boolean;
  /**
   * How the UI's view of a directory listing stays truthful after a mutation:
   * - 'watch' — driver pushes change events; the renderer patches entries as they arrive.
   * - 'optimistic' — the renderer predicts the new state and applies it immediately, no refetch.
   * - 'sync' — await the mutation, then force a full refetch.
   */
  sync: 'watch' | 'optimistic' | 'sync';
}

export interface FileDriver {
  id: string;
  capabilities: DriverCapabilities;
  listDirectory(uri: string, cursor?: string): Promise<ListDirectoryResult>;
  readFile(uri: string): Promise<ReadFileResult>;
  writeFile(uri: string, content: string): Promise<WriteFileResult>;
  deleteEntries(uris: string[]): Promise<MutationResult>;
  copyEntries(sourceUris: string[], destDirUri: string): Promise<MutationResult>;
  moveEntries(sourceUris: string[], destDirUri: string): Promise<MutationResult>;
  createFile(destDirUri: string, name: string): Promise<CreateResult>;
  createFolder(destDirUri: string, name: string): Promise<CreateResult>;
}
