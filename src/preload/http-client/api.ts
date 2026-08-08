import { ipcRenderer, type IpcRendererEvent } from 'electron';
import type {
  Collection,
  CreateCollectionPayload,
  CreateEnvironmentPayload,
  CreateFolderPayload,
  DeleteCollectionPayload,
  DeleteEnvironmentPayload,
  DeleteExamplePayload,
  DeleteFolderPayload,
  DeleteRequestPayload,
  DeleteWorkspacePayload,
  Environment,
  ExportCollectionPayload,
  ExportCollectionResult,
  ExportEnvironmentPayload,
  ExportEnvironmentResult,
  HttpRequestPayload,
  HttpResponsePayload,
  ImportCollectionResult,
  ImportEnvironmentResult,
  MoveFolderPayload,
  MoveRequestPayload,
  OAuth2TokenRequest,
  OAuth2TokenResult,
  RenameCollectionPayload,
  RenameEnvironmentPayload,
  RenameExamplePayload,
  RenameFolderPayload,
  RenameRequestPayload,
  RenameWorkspacePayload,
  ResolveEnvironmentImportPayload,
  SaveEnvironmentVariablesPayload,
  SaveExamplePayload,
  SaveRequestPayload,
  SetCollectionAuthPayload,
  SetFolderAuthPayload,
  Workspace,
  WsAckResult,
  WsConnectPayload,
  WsDisconnectPayload,
  WsEvent,
  WsSendPayload
} from './types';

/** Shape of the Postman tool's renderer-facing IPC bridge, exposed on `window.api`. */
export interface PostmanBridge {
  http: {
    send: (payload: HttpRequestPayload) => Promise<HttpResponsePayload>;
    oauth2GetToken: (payload: OAuth2TokenRequest) => Promise<OAuth2TokenResult>;
  };
  ws: {
    connect: (payload: WsConnectPayload) => Promise<WsAckResult>;
    send: (payload: WsSendPayload) => Promise<WsAckResult>;
    disconnect: (payload: WsDisconnectPayload) => Promise<WsAckResult>;
    onEvent: (callback: (event: WsEvent) => void) => () => void;
  };
  collections: {
    list: (workspaceId: string) => Promise<Collection[]>;
    create: (payload: CreateCollectionPayload) => Promise<Collection>;
    rename: (payload: RenameCollectionPayload) => Promise<WsAckResult>;
    remove: (payload: DeleteCollectionPayload) => Promise<WsAckResult>;
    saveRequest: (payload: SaveRequestPayload) => Promise<WsAckResult>;
    renameRequest: (payload: RenameRequestPayload) => Promise<WsAckResult>;
    deleteRequest: (payload: DeleteRequestPayload) => Promise<WsAckResult>;
    saveExample: (payload: SaveExamplePayload) => Promise<WsAckResult>;
    renameExample: (payload: RenameExamplePayload) => Promise<WsAckResult>;
    deleteExample: (payload: DeleteExamplePayload) => Promise<WsAckResult>;
    createFolder: (payload: CreateFolderPayload) => Promise<WsAckResult>;
    renameFolder: (payload: RenameFolderPayload) => Promise<WsAckResult>;
    deleteFolder: (payload: DeleteFolderPayload) => Promise<WsAckResult>;
    moveRequest: (payload: MoveRequestPayload) => Promise<WsAckResult>;
    moveFolder: (payload: MoveFolderPayload) => Promise<WsAckResult>;
    setCollectionAuth: (payload: SetCollectionAuthPayload) => Promise<WsAckResult>;
    setFolderAuth: (payload: SetFolderAuthPayload) => Promise<WsAckResult>;
    exportToFile: (payload: ExportCollectionPayload) => Promise<ExportCollectionResult>;
    importFromFile: (workspaceId: string) => Promise<ImportCollectionResult>;
  };
  environments: {
    list: (workspaceId: string) => Promise<Environment[]>;
    create: (payload: CreateEnvironmentPayload) => Promise<Environment>;
    rename: (payload: RenameEnvironmentPayload) => Promise<WsAckResult>;
    remove: (payload: DeleteEnvironmentPayload) => Promise<WsAckResult>;
    saveVariables: (payload: SaveEnvironmentVariablesPayload) => Promise<WsAckResult>;
    exportToFile: (payload: ExportEnvironmentPayload) => Promise<ExportEnvironmentResult>;
    importFromFile: (workspaceId: string) => Promise<ImportEnvironmentResult>;
    resolveImportConflict: (
      payload: ResolveEnvironmentImportPayload
    ) => Promise<ImportEnvironmentResult>;
  };
  workspaces: {
    list: () => Promise<Workspace[]>;
    create: (name: string) => Promise<Workspace>;
    rename: (payload: RenameWorkspacePayload) => Promise<WsAckResult>;
    remove: (payload: DeleteWorkspacePayload) => Promise<WsAckResult>;
  };
}

/** The Postman tool's renderer-facing IPC bridge: REST client, WebSocket client, saved collections, and environments. */
export const postmanApi: PostmanBridge = {
  // REST client - executed in the main process to avoid renderer CORS limits.
  http: {
    send: (payload: HttpRequestPayload): Promise<HttpResponsePayload> =>
      ipcRenderer.invoke('http:send', payload),
    oauth2GetToken: (payload: OAuth2TokenRequest): Promise<OAuth2TokenResult> =>
      ipcRenderer.invoke('http:oauth2GetToken', payload)
  },

  // WebSocket client - sockets live in the main process; the renderer only
  // sends commands and subscribes to a shared event stream.
  ws: {
    connect: (payload: WsConnectPayload): Promise<WsAckResult> =>
      ipcRenderer.invoke('ws:connect', payload),
    send: (payload: WsSendPayload): Promise<WsAckResult> => ipcRenderer.invoke('ws:send', payload),
    disconnect: (payload: WsDisconnectPayload): Promise<WsAckResult> =>
      ipcRenderer.invoke('ws:disconnect', payload),
    onEvent: (callback: (event: WsEvent) => void): (() => void) => {
      const listener = (_event: IpcRendererEvent, data: WsEvent): void => callback(data);
      ipcRenderer.on('ws:event', listener);
      return () => ipcRenderer.removeListener('ws:event', listener);
    }
  },

  // Collections - saved requests persisted to disk in the main process.
  collections: {
    list: (workspaceId: string): Promise<Collection[]> =>
      ipcRenderer.invoke('collections:list', workspaceId),
    create: (payload: CreateCollectionPayload): Promise<Collection> =>
      ipcRenderer.invoke('collections:create', payload),
    rename: (payload: RenameCollectionPayload): Promise<WsAckResult> =>
      ipcRenderer.invoke('collections:rename', payload),
    remove: (payload: DeleteCollectionPayload): Promise<WsAckResult> =>
      ipcRenderer.invoke('collections:delete', payload),
    saveRequest: (payload: SaveRequestPayload): Promise<WsAckResult> =>
      ipcRenderer.invoke('collections:saveRequest', payload),
    renameRequest: (payload: RenameRequestPayload): Promise<WsAckResult> =>
      ipcRenderer.invoke('collections:renameRequest', payload),
    deleteRequest: (payload: DeleteRequestPayload): Promise<WsAckResult> =>
      ipcRenderer.invoke('collections:deleteRequest', payload),
    saveExample: (payload: SaveExamplePayload): Promise<WsAckResult> =>
      ipcRenderer.invoke('collections:saveExample', payload),
    renameExample: (payload: RenameExamplePayload): Promise<WsAckResult> =>
      ipcRenderer.invoke('collections:renameExample', payload),
    deleteExample: (payload: DeleteExamplePayload): Promise<WsAckResult> =>
      ipcRenderer.invoke('collections:deleteExample', payload),
    createFolder: (payload: CreateFolderPayload): Promise<WsAckResult> =>
      ipcRenderer.invoke('collections:createFolder', payload),
    renameFolder: (payload: RenameFolderPayload): Promise<WsAckResult> =>
      ipcRenderer.invoke('collections:renameFolder', payload),
    deleteFolder: (payload: DeleteFolderPayload): Promise<WsAckResult> =>
      ipcRenderer.invoke('collections:deleteFolder', payload),
    moveRequest: (payload: MoveRequestPayload): Promise<WsAckResult> =>
      ipcRenderer.invoke('collections:moveRequest', payload),
    moveFolder: (payload: MoveFolderPayload): Promise<WsAckResult> =>
      ipcRenderer.invoke('collections:moveFolder', payload),
    setCollectionAuth: (payload: SetCollectionAuthPayload): Promise<WsAckResult> =>
      ipcRenderer.invoke('collections:setCollectionAuth', payload),
    setFolderAuth: (payload: SetFolderAuthPayload): Promise<WsAckResult> =>
      ipcRenderer.invoke('collections:setFolderAuth', payload),
    exportToFile: (payload: ExportCollectionPayload): Promise<ExportCollectionResult> =>
      ipcRenderer.invoke('collections:exportToFile', payload),
    importFromFile: (workspaceId: string): Promise<ImportCollectionResult> =>
      ipcRenderer.invoke('collections:importFromFile', workspaceId)
  },

  // Environments - named sets of {{variable}} values, persisted to disk.
  environments: {
    list: (workspaceId: string): Promise<Environment[]> =>
      ipcRenderer.invoke('environments:list', workspaceId),
    create: (payload: CreateEnvironmentPayload): Promise<Environment> =>
      ipcRenderer.invoke('environments:create', payload),
    rename: (payload: RenameEnvironmentPayload): Promise<WsAckResult> =>
      ipcRenderer.invoke('environments:rename', payload),
    remove: (payload: DeleteEnvironmentPayload): Promise<WsAckResult> =>
      ipcRenderer.invoke('environments:delete', payload),
    saveVariables: (payload: SaveEnvironmentVariablesPayload): Promise<WsAckResult> =>
      ipcRenderer.invoke('environments:saveVariables', payload),
    exportToFile: (payload: ExportEnvironmentPayload): Promise<ExportEnvironmentResult> =>
      ipcRenderer.invoke('environments:exportToFile', payload),
    importFromFile: (workspaceId: string): Promise<ImportEnvironmentResult> =>
      ipcRenderer.invoke('environments:importFromFile', workspaceId),
    resolveImportConflict: (
      payload: ResolveEnvironmentImportPayload
    ): Promise<ImportEnvironmentResult> =>
      ipcRenderer.invoke('environments:resolveImportConflict', payload)
  },

  // Workspaces - scope collections/environments into named groups, like Postman workspaces.
  workspaces: {
    list: (): Promise<Workspace[]> => ipcRenderer.invoke('workspaces:list'),
    create: (name: string): Promise<Workspace> => ipcRenderer.invoke('workspaces:create', name),
    rename: (payload: RenameWorkspacePayload): Promise<WsAckResult> =>
      ipcRenderer.invoke('workspaces:rename', payload),
    remove: (payload: DeleteWorkspacePayload): Promise<WsAckResult> =>
      ipcRenderer.invoke('workspaces:delete', payload)
  }
};
