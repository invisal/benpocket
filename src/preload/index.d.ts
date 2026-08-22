import { type ElectronAPI } from '@electron-toolkit/preload';
import type { ScreenRecorderApi } from './screen-recorder/api';
import type { KuberneterApi } from './kuberneter/api';
import type { HttpClientBridge } from './http-client/api';
import type { FileExplorerApi } from './file-explorer/api';
import type { ImageEditorApi } from './image-editor/api';
import type { ProfilesApi } from './store/api';
import type { AuthApi } from './auth/api';
import type { UpdaterApi } from './updater/api';
import type { TelemetryApi } from './telemetry/api';
import type { SystemApi } from './system/api';
import type { KeybindingsApi } from './keybindings/api';

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
    imageEditor: ImageEditorApi;
    profiles: ProfilesApi;
    auth: AuthApi;
    updater: UpdaterApi;
    telemetry: TelemetryApi;
    system: SystemApi;
    keybindings: KeybindingsApi;
    api: {
      platform: string;
      /** Linux Wayland — PipeWire portal picker instead of in-app source grid. */
      usesOsCapturePicker: boolean;
      /** True only when launched with BENPOCKET_E2E=1 (see e2e/). Gates `window.devTools`. */
      isE2E: boolean;
      minimize: () => void;
      maximize: () => void;
      close: () => void;
      openDirectory: () => Promise<{
        path: string;
        tree: FileTreeNode | null;
      } | null>;
    } & HttpClientBridge;
  }
}
