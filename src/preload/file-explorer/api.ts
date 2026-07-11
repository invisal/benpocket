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

export interface FileExplorerApi {
  getHomeDir: () => Promise<string>;
  listDirectory: (dirPath: string) => Promise<ListDirectoryResponse>;
  getFileIcon: (filePath: string, extension: string) => Promise<string | null>;
  openPath: (targetPath: string) => Promise<{ success: true } | { error: string }>;
  getSidebarSections: () => Promise<SidebarSections>;
  readFileContent: (filePath: string) => Promise<ReadFileContentResponse>;
}

export const fileExplorerApi: FileExplorerApi = {
  getHomeDir: () => ipcRenderer.invoke('file-explorer:get-home-dir'),
  listDirectory: (dirPath) => ipcRenderer.invoke('file-explorer:list-directory', dirPath),
  getFileIcon: (filePath, extension) =>
    ipcRenderer.invoke('file-explorer:get-file-icon', filePath, extension),
  openPath: (targetPath) => ipcRenderer.invoke('file-explorer:open-path', targetPath),
  getSidebarSections: () => ipcRenderer.invoke('file-explorer:get-sidebar-sections'),
  readFileContent: (filePath) => ipcRenderer.invoke('file-explorer:read-file-content', filePath)
};
