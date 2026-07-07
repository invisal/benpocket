import { ElectronAPI } from '@electron-toolkit/preload';
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

declare global {
  interface Window {
    electron: ElectronAPI;
    api: {
      platform: string;
      minimize: () => void;
      maximize: () => void;
      close: () => void;
      openDirectory: () => Promise<{
        path: string;
        tree: {
          name: string;
          path: string;
          isDirectory: boolean;
          children?: Array<any>;
        } | null;
      } | null>;
      http: {
        send: (payload: HttpRequestPayload) => Promise<HttpResponsePayload>;
      };
      ws: {
        connect: (payload: WsConnectPayload) => Promise<WsAckResult>;
        send: (payload: WsSendPayload) => Promise<WsAckResult>;
        disconnect: (payload: WsDisconnectPayload) => Promise<WsAckResult>;
        onEvent: (callback: (event: WsEvent) => void) => () => void;
      };
      collections: {
        list: () => Promise<Collection[]>;
        create: (name: string) => Promise<Collection>;
        rename: (payload: RenameCollectionPayload) => Promise<WsAckResult>;
        remove: (payload: DeleteCollectionPayload) => Promise<WsAckResult>;
        saveRequest: (payload: SaveRequestPayload) => Promise<WsAckResult>;
        renameRequest: (payload: RenameRequestPayload) => Promise<WsAckResult>;
        deleteRequest: (payload: DeleteRequestPayload) => Promise<WsAckResult>;
        exportToFile: (payload: ExportCollectionPayload) => Promise<ExportCollectionResult>;
        importFromFile: () => Promise<ImportCollectionResult>;
      };
      environments: {
        list: () => Promise<Environment[]>;
        create: (name: string) => Promise<Environment>;
        rename: (payload: RenameEnvironmentPayload) => Promise<WsAckResult>;
        remove: (payload: DeleteEnvironmentPayload) => Promise<WsAckResult>;
        saveVariables: (payload: SaveEnvironmentVariablesPayload) => Promise<WsAckResult>;
      };
    };
  }
}
