import Store from 'electron-store';

export interface AppSettings {
  defaultExportFormat: 'mp4' | 'gif';
}

export const settingsStore = new Store<AppSettings>({
  defaults: {
    defaultExportFormat: 'mp4'
  }
});
