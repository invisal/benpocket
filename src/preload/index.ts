import { contextBridge, ipcRenderer } from 'electron';
import { electronAPI } from '@electron-toolkit/preload';
import { screenRecorderApi } from './screen-recorder/api';
import { kuberneterApi } from './kuberneter/api';
import { postmanApi } from './http-client/api';
import { fileExplorerApi } from './file-explorer/api';
import { profilesApi } from './store/api';
import { usesOsCapturePicker } from '@shared/uses-os-capture-picker';

// Custom APIs for renderer
const api = {
  platform: process.platform,
  usesOsCapturePicker: usesOsCapturePicker(),
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  openDirectory: () => ipcRenderer.invoke('open-directory'),
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
    contextBridge.exposeInMainWorld('profiles', profilesApi);
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
  // @ts-ignore (define in dts)
  window.profiles = profilesApi;
}
