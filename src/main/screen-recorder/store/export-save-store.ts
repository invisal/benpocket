import Store from 'electron-store';

interface ExportSaveSchema {
  // Distinct key from screen-capture-store.ts's `lastSaveDir` -- both stores
  // default to the same underlying `config.json` (electron-store's default
  // `name: 'config'`), so a shared key name would clobber the other tool's
  // remembered directory.
  lastExportSaveDir: string | null;
}

export const exportSaveStore = new Store<ExportSaveSchema>({
  defaults: { lastExportSaveDir: null }
});

export function getLastExportSaveDir(): string | null {
  return exportSaveStore.get('lastExportSaveDir');
}

export function setLastExportSaveDir(dir: string): void {
  exportSaveStore.set('lastExportSaveDir', dir);
}
