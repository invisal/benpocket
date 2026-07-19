import { type ElectronAPI } from '@electron-toolkit/preload';
import type { ScreenRecorderApi } from './screen-recorder/api';
import type { KuberneterApi } from './kuberneter/api';
import type { PostmanBridge } from './http-client/api';
import type { FileExplorerApi } from './file-explorer/api';

interface FileTreeNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: FileTreeNode[];
}

declare global {
  interface Window {
    electron: ElectronAPI;
    screenRecorder: ScreenRecorderApi;
    kuberneter: KuberneterApi;
    fileExplorer: FileExplorerApi;
    api: {
      platform: string;
      /** Linux Wayland — PipeWire portal picker instead of in-app source grid. */
      usesOsCapturePicker: boolean;
      minimize: () => void;
      maximize: () => void;
      close: () => void;
      openDirectory: () => Promise<{
        path: string;
        tree: FileTreeNode | null;
      } | null>;
    } & PostmanBridge;
  }
}
