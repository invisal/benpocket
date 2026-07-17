import { contextBridge, ipcRenderer } from 'electron';
import { electronAPI } from '@electron-toolkit/preload';
import { IpcChannels } from '@shared/ipc-channels';
import { screenRecorderApi } from './screen-recorder/api';
import { kuberneterApi } from './kuberneter/api';
import { postmanApi } from './http-client/api';
import { fileExplorerApi } from './file-explorer/api';
import { usesOsCapturePicker } from '@shared/uses-os-capture-picker';

// Custom APIs for renderer
const api = {
  platform: process.platform,
  usesOsCapturePicker: usesOsCapturePicker(),
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  openDirectory: () => ipcRenderer.invoke('open-directory'),
  showNotification: (title: string, body: string): Promise<boolean> =>
    ipcRenderer.invoke(IpcChannels.ShowNotification, title, body),
  debug: {
    toggleDevTools: (): Promise<void> => ipcRenderer.invoke('debug:toggle-devtools'),
    toggleContextMenu: (): Promise<boolean> => ipcRenderer.invoke('debug:toggle-context-menu'),
    getContextMenuEnabled: (): Promise<boolean> =>
      ipcRenderer.invoke('debug:get-context-menu-enabled')
  },
  ...postmanApi
};

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI);
    contextBridge.exposeInMainWorld('api', api);
    contextBridge.exposeInMainWorld('screenRecorder', screenRecorderApi);
    contextBridge.exposeInMainWorld('kuberneter', kuberneterApi);
    contextBridge.exposeInMainWorld('fileExplorer', fileExplorerApi);
  } catch (error) {
    console.error(error);
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI;
  // @ts-ignore (define in dts)
  window.api = api;
  // @ts-ignore (define in dts)
  window.screenRecorder = screenRecorderApi;
  // @ts-ignore (define in dts)
  window.kuberneter = kuberneterApi;
  // @ts-ignore (define in dts)
  window.fileExplorer = fileExplorerApi;
}
