import { ElectronAPI } from '@electron-toolkit/preload';

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
    };
  }
}
