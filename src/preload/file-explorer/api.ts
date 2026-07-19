import { ipcRenderer } from 'electron';
import { IpcChannels } from '@shared/ipc-channels';

export interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modifiedMs: number;
  extension: string;
}

export type ListDirectoryResponse =
  { entries: FileEntry[]; nextCursor: string | null } | { error: string };

export interface SidebarItem {
  label: string;
  path: string;
}

export interface SidebarSections {
  favorites: SidebarItem[];
  locations: SidebarItem[];
  r2Buckets: SidebarItem[];
}

export type ReadFileContentResponse =
  | { content: string }
  | { error: 'too-large'; maxBytes: number }
  | { error: 'unsupported-extension' }
  | { error: string };

export type ReadBinaryFileResponse =
  | { data: Uint8Array; mimeType: string }
  | { error: 'too-large'; maxBytes: number }
  | { error: 'unsupported-extension' }
  | { error: string };

export type WriteFileContentResponse = { success: true } | { error: string };

export type ClipboardMode = 'copy' | 'cut';
export type ClipboardFiles = { paths: string[]; mode: ClipboardMode };

export interface R2CredentialStatus {
  configured: boolean;
  selectedBuckets: string[];
}

export interface R2Bucket {
  name: string;
}

export interface AiGatewayCredentialStatus {
  configured: boolean;
  /** True once Cloudflare (accountId/apiToken) is connected -- reused from the R2 credential. */
  cloudflareConnected: boolean;
  gatewayId: string;
  model: string;
}

export interface AgentToolCall {
  id: string;
  /** JSON-encoded arguments, exactly as returned by the model. */
  arguments: string;
  name: string;
}

export interface AgentMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  toolCalls?: AgentToolCall[];
  toolCallId?: string;
  name?: string;
}

export interface AgentUsage {
  promptTokens: number;
  completionTokens: number;
  cachedTokens: number;
}

export type AgentSendResponse = { message: AgentMessage; usage?: AgentUsage } | { error: string };

export type AgentToolResult = { success: true; result: unknown } | { error: string };

/** Progress for a copy/move that streams bytes between local disk and R2. */
export interface TransferProgress {
  currentFile: string;
  filesCompleted: number;
  totalFiles: number;
  bytesTransferred: number;
  totalBytes: number;
}

export interface FileExplorerApi {
  getHomeDir: () => Promise<string>;
  listDirectory: (dirPath: string, cursor?: string) => Promise<ListDirectoryResponse>;
  getFileIcon: (filePath: string, extension: string) => Promise<string | null>;
  openPath: (targetPath: string) => Promise<{ success: true } | { error: string }>;
  getSidebarSections: () => Promise<SidebarSections>;
  readFileContent: (filePath: string) => Promise<ReadFileContentResponse>;
  readFileBinary: (filePath: string) => Promise<ReadBinaryFileResponse>;
  writeFileContent: (filePath: string, content: string) => Promise<WriteFileContentResponse>;
  deleteEntries: (paths: string[]) => Promise<{ success: true } | { error: string }>;
  copyEntries: (
    sourcePaths: string[],
    destDir: string
  ) => Promise<{ success: true } | { error: string }>;
  moveEntries: (
    sourcePaths: string[],
    destDir: string
  ) => Promise<{ success: true } | { error: string }>;
  onTransferProgress: (callback: (progress: TransferProgress) => void) => () => void;
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
  getR2CredentialStatus: () => Promise<R2CredentialStatus>;
  setR2Credential: (
    accountId: string,
    apiToken: string,
    accessKeyId?: string,
    secretAccessKey?: string
  ) => Promise<{ success: true } | { error: string }>;
  clearR2Credential: () => Promise<void>;
  listR2Buckets: () => Promise<R2Bucket[] | { error: string }>;
  setSelectedR2Buckets: (bucketNames: string[]) => Promise<{ success: true } | { error: string }>;
  getAiGatewayCredentialStatus: () => Promise<AiGatewayCredentialStatus>;
  setAiGatewayCredential: (
    gatewayId: string,
    model: string
  ) => Promise<{ success: true } | { error: string }>;
  clearAiGatewayCredential: () => Promise<void>;
  agentSend: (messages: AgentMessage[]) => Promise<AgentSendResponse>;
  agentExecuteTool: (name: string, args: unknown) => Promise<AgentToolResult>;
}

export const fileExplorerApi: FileExplorerApi = {
  getHomeDir: () => ipcRenderer.invoke('file-explorer:get-home-dir'),
  listDirectory: (dirPath, cursor) =>
    ipcRenderer.invoke('file-explorer:list-directory', dirPath, cursor),
  getFileIcon: (filePath, extension) =>
    ipcRenderer.invoke('file-explorer:get-file-icon', filePath, extension),
  openPath: (targetPath) => ipcRenderer.invoke('file-explorer:open-path', targetPath),
  getSidebarSections: () => ipcRenderer.invoke('file-explorer:get-sidebar-sections'),
  readFileContent: (filePath) => ipcRenderer.invoke('file-explorer:read-file-content', filePath),
  readFileBinary: (filePath) => ipcRenderer.invoke('file-explorer:read-file-binary', filePath),
  writeFileContent: (filePath, content) =>
    ipcRenderer.invoke('file-explorer:write-file-content', filePath, content),
  deleteEntries: (paths) => ipcRenderer.invoke('file-explorer:delete-entries', paths),
  copyEntries: (sourcePaths, destDir) =>
    ipcRenderer.invoke('file-explorer:copy-entries', sourcePaths, destDir),
  moveEntries: (sourcePaths, destDir) =>
    ipcRenderer.invoke('file-explorer:move-entries', sourcePaths, destDir),
  onTransferProgress: (callback): (() => void) => {
    const listener = (_event: unknown, progress: TransferProgress): void => callback(progress);
    ipcRenderer.on(IpcChannels.FileExplorerTransferProgress, listener);
    return () => ipcRenderer.removeListener(IpcChannels.FileExplorerTransferProgress, listener);
  },
  writeClipboardFiles: (paths, mode) =>
    ipcRenderer.invoke('file-explorer:clipboard-write', paths, mode),
  readClipboardFiles: () => ipcRenderer.invoke('file-explorer:clipboard-read'),
  createFile: (destDir, name) => ipcRenderer.invoke('file-explorer:create-file', destDir, name),
  createFolder: (destDir, name) => ipcRenderer.invoke('file-explorer:create-folder', destDir, name),
  getR2CredentialStatus: () => ipcRenderer.invoke('file-explorer:get-r2-credential-status'),
  setR2Credential: (accountId, apiToken, accessKeyId = '', secretAccessKey = '') =>
    ipcRenderer.invoke(
      'file-explorer:set-r2-credential',
      accountId,
      apiToken,
      accessKeyId,
      secretAccessKey
    ),
  clearR2Credential: () => ipcRenderer.invoke('file-explorer:clear-r2-credential'),
  listR2Buckets: () => ipcRenderer.invoke('file-explorer:list-r2-buckets'),
  setSelectedR2Buckets: (bucketNames) =>
    ipcRenderer.invoke('file-explorer:set-selected-r2-buckets', bucketNames),
  getAiGatewayCredentialStatus: () =>
    ipcRenderer.invoke('file-explorer:get-ai-gateway-credential-status'),
  setAiGatewayCredential: (gatewayId, model) =>
    ipcRenderer.invoke('file-explorer:set-ai-gateway-credential', gatewayId, model),
  clearAiGatewayCredential: () => ipcRenderer.invoke('file-explorer:clear-ai-gateway-credential'),
  agentSend: (messages) => ipcRenderer.invoke('file-explorer:agent-send', messages),
  agentExecuteTool: (name, args) =>
    ipcRenderer.invoke('file-explorer:agent-execute-tool', name, args)
};
