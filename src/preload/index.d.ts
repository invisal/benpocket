import { ElectronAPI } from '@electron-toolkit/preload';
import type { ScreenRecorderApi } from './screen-recorder/api';
import type { PostmanBridge } from './http-client/api';

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
    api: {
      platform: string;
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
