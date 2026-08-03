import { ipcRenderer, type IpcRendererEvent } from 'electron';

export type UpdaterStatus =
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'available'; version: string }
  | { state: 'not-available' }
  | { state: 'downloading'; percent: number; version: string }
  | { state: 'downloaded'; version: string }
  | { state: 'error'; message: string };

export interface UpdaterApi {
  /** Manual re-check against the GitHub Releases feed. No-op (resolves to 'not-available') in unpackaged dev builds. */
  check: () => Promise<void>;
  /** Downloads the already-detected available update, then quits and installs it once the download finishes -- no separate confirmation step. */
  update: () => Promise<void>;
  /** One-shot read of the current status, for a freshly-mounted UI to sync before the next push. */
  getStatus: () => Promise<UpdaterStatus>;
  /** Live push of every status transition. Returns an unsubscribe function. */
  onStatusChanged: (callback: (status: UpdaterStatus) => void) => () => void;
}

export const updaterApi: UpdaterApi = {
  check: () => ipcRenderer.invoke('updater:check'),
  update: () => ipcRenderer.invoke('updater:update'),
  getStatus: () => ipcRenderer.invoke('updater:get-status'),
  onStatusChanged: (callback) => {
    const listener = (_event: IpcRendererEvent, status: UpdaterStatus): void => callback(status);
    ipcRenderer.on('updater:status-changed', listener);
    return () => ipcRenderer.removeListener('updater:status-changed', listener);
  }
};
