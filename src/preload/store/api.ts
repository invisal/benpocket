import { ipcRenderer, type IpcRendererEvent } from 'electron';
import type {
  CreateProfileOptions,
  CreateProfileResult,
  ProfileDescriptor,
  ProfileId,
  SwitchProfileResult,
  SyncResult,
  SyncStatusResult
} from './types';

export interface ProfilesApi {
  list: () => Promise<ProfileDescriptor[]>;
  getActive: () => Promise<ProfileDescriptor>;
  switch: (profileId: ProfileId) => Promise<SwitchProfileResult>;
  create: (options: CreateProfileOptions) => Promise<CreateProfileResult>;
  delete: (profileId: ProfileId) => Promise<SwitchProfileResult>;
  /** __DEV__ only: native file dialog for picking/creating a mock-remote profile's sqlite file. */
  pickMockServerFile: (mode: 'create' | 'open') => Promise<string | null>;
  /** Doc persistence on the active profile -- backs usePersistStore. */
  loadSnapshot: (key: string) => Promise<Uint8Array | null>;
  appendPatch: (key: string, patch: Uint8Array) => Promise<void>;
  /** Count of the active profile's patches not yet pushed -- backs the status bar's sync indicator. */
  getUnpushedCount: () => Promise<number>;
  /** Cheap remote precheck ({ hasChanges, latestSeq }) for the active profile, without pushing/pulling anything. */
  checkStatus: () => Promise<SyncStatusResult>;
  sync: () => Promise<SyncResult>;
  /** Live push of the active profile's unpushed count after every appendPatch/sync/switch/delete. Returns an unsubscribe function. */
  onUnpushedCountChanged: (callback: (count: number) => void) => () => void;
  /** Live push of docKeys that received new remote patches via sync() -- lets usePersistStore reload just its own key. Returns an unsubscribe function. */
  onDocsChanged: (callback: (keys: string[]) => void) => () => void;
}

export const profilesApi: ProfilesApi = {
  list: () => ipcRenderer.invoke('profiles:list'),
  getActive: () => ipcRenderer.invoke('profiles:get-active'),
  switch: (profileId) => ipcRenderer.invoke('profiles:switch', profileId),
  create: (options) => ipcRenderer.invoke('profiles:create', options),
  delete: (profileId) => ipcRenderer.invoke('profiles:delete', profileId),
  pickMockServerFile: (mode) => ipcRenderer.invoke('profiles:pick-mock-server-file', mode),
  loadSnapshot: (key) => ipcRenderer.invoke('profiles:load-snapshot', key),
  appendPatch: (key, patch) => ipcRenderer.invoke('profiles:append-patch', key, patch),
  getUnpushedCount: () => ipcRenderer.invoke('profiles:unpushed-count'),
  checkStatus: () => ipcRenderer.invoke('profiles:status'),
  sync: () => ipcRenderer.invoke('profiles:sync'),
  onUnpushedCountChanged: (callback) => {
    const listener = (_event: IpcRendererEvent, count: number): void => callback(count);
    ipcRenderer.on('profiles:unpushed-count-changed', listener);
    return () => ipcRenderer.removeListener('profiles:unpushed-count-changed', listener);
  },
  onDocsChanged: (callback) => {
    const listener = (_event: IpcRendererEvent, keys: string[]): void => callback(keys);
    ipcRenderer.on('profiles:docs-changed', listener);
    return () => ipcRenderer.removeListener('profiles:docs-changed', listener);
  }
};
