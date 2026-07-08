import Store from 'electron-store';
import { DefaultShortcuts } from '@screen-studio/types/shortcuts';

export interface AppSettings {
  shortcuts: typeof DefaultShortcuts;
  defaultExportFormat: 'mp4' | 'gif';
}

export const settingsStore = new Store<AppSettings>({
  defaults: {
    shortcuts: DefaultShortcuts,
    defaultExportFormat: 'mp4'
  }
});
