import { ipcRenderer } from 'electron';

export interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modifiedMs: number;
  extension: string;
}

export type ListDirectoryResponse = { entries: FileEntry[] } | { error: string };

export interface SidebarItem {
  label: string;
  path: string;
}

export interface SidebarSections {
  favorites: SidebarItem[];
  locations: SidebarItem[];
}

export type ReadFileContentResponse =
  | { content: string }
  | { error: 'too-large'; maxBytes: number }
  | { error: 'unsupported-extension' }
  | { error: string };

export type ClipboardMode = 'copy' | 'cut';
export type ClipboardFiles = { paths: string[]; mode: ClipboardMode };

export interface FileExplorerApi {
  getHomeDir: () => Promise<string>;
  listDirectory: (dirPath: string) => Promise<ListDirectoryResponse>;
  getFileIcon: (filePath: string, extension: string) => Promise<string | null>;
  openPath: (targetPath: string) => Promise<{ success: true } | { error: string }>;
  getSidebarSections: () => Promise<SidebarSections>;
  readFileContent: (filePath: string) => Promise<ReadFileContentResponse>;
  deleteEntries: (paths: string[]) => Promise<{ success: true } | { error: string }>;
  copyEntries: (
    sourcePaths: string[],
    destDir: string
  ) => Promise<{ success: true } | { error: string }>;
  moveEntries: (
    sourcePaths: string[],
    destDir: string
  ) => Promise<{ success: true } | { error: string }>;
  writeClipboardFiles: (paths: string[], mode: ClipboardMode) => Promise<void>;
  readClipboardFiles: () => Promise<ClipboardFiles | null>;
  createFile: (
    destDir: string,
    name: string
  ) => Promise<{ success: true; path: string } | { error: 'exists' } | { error: string }>;
  createFolder: (
    destDir: string,
    name: string
  ) => Promise<{ success: true; path: string } | { error: 'exists' } | { error: string }>;
}

export const fileExplorerApi: FileExplorerApi = {
  getHomeDir: () => ipcRenderer.invoke('file-explorer:get-home-dir'),
  listDirectory: (dirPath) => ipcRenderer.invoke('file-explorer:list-directory', dirPath),
  getFileIcon: (filePath, extension) =>
    ipcRenderer.invoke('file-explorer:get-file-icon', filePath, extension),
  openPath: (targetPath) => ipcRenderer.invoke('file-explorer:open-path', targetPath),
  getSidebarSections: () => ipcRenderer.invoke('file-explorer:get-sidebar-sections'),
  readFileContent: (filePath) => ipcRenderer.invoke('file-explorer:read-file-content', filePath),
  deleteEntries: (paths) => ipcRenderer.invoke('file-explorer:delete-entries', paths),
  copyEntries: (sourcePaths, destDir) =>
    ipcRenderer.invoke('file-explorer:copy-entries', sourcePaths, destDir),
  moveEntries: (sourcePaths, destDir) =>
    ipcRenderer.invoke('file-explorer:move-entries', sourcePaths, destDir),
  writeClipboardFiles: (paths, mode) =>
    ipcRenderer.invoke('file-explorer:clipboard-write', paths, mode),
  readClipboardFiles: () => ipcRenderer.invoke('file-explorer:clipboard-read'),
  createFile: (destDir, name) => ipcRenderer.invoke('file-explorer:create-file', destDir, name),
  createFolder: (destDir, name) => ipcRenderer.invoke('file-explorer:create-folder', destDir, name)
};
