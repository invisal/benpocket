import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import { electronAPI } from '@electron-toolkit/preload';
import type {
  Collection,
  DeleteCollectionPayload,
  DeleteEnvironmentPayload,
  DeleteRequestPayload,
  Environment,
  ExportCollectionPayload,
  ExportCollectionResult,
  HttpRequestPayload,
  HttpResponsePayload,
  ImportCollectionResult,
  RenameCollectionPayload,
  RenameEnvironmentPayload,
  RenameRequestPayload,
  SaveEnvironmentVariablesPayload,
  SaveRequestPayload,
  WsAckResult,
  WsConnectPayload,
  WsDisconnectPayload,
  WsEvent,
  WsSendPayload
} from './postman.types';

// Custom APIs for renderer
const api = {
  platform: process.platform,
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  openDirectory: () => ipcRenderer.invoke('open-directory'),

  // REST client - executed in the main process to avoid renderer CORS limits.
  http: {
    send: (payload: HttpRequestPayload): Promise<HttpResponsePayload> =>
      ipcRenderer.invoke('http:send', payload)
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
    list: (): Promise<Collection[]> => ipcRenderer.invoke('collections:list'),
    create: (name: string): Promise<Collection> => ipcRenderer.invoke('collections:create', name),
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
    exportToFile: (payload: ExportCollectionPayload): Promise<ExportCollectionResult> =>
      ipcRenderer.invoke('collections:exportToFile', payload),
    importFromFile: (): Promise<ImportCollectionResult> => ipcRenderer.invoke('collections:importFromFile')
  },

  // Environments - named sets of {{variable}} values, persisted to disk.
  environments: {
    list: (): Promise<Environment[]> => ipcRenderer.invoke('environments:list'),
    create: (name: string): Promise<Environment> => ipcRenderer.invoke('environments:create', name),
    rename: (payload: RenameEnvironmentPayload): Promise<WsAckResult> =>
      ipcRenderer.invoke('environments:rename', payload),
    remove: (payload: DeleteEnvironmentPayload): Promise<WsAckResult> =>
      ipcRenderer.invoke('environments:delete', payload),
    saveVariables: (payload: SaveEnvironmentVariablesPayload): Promise<WsAckResult> =>
      ipcRenderer.invoke('environments:saveVariables', payload)
  }
};

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI);
    contextBridge.exposeInMainWorld('api', api);
  } catch (error) {
    console.error(error);
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI;
  // @ts-ignore (define in dts)
  window.api = api;
}
