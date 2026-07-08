import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import { join } from 'path';
import { IpcChannels } from '@shared/ipc-channels';
import type { ExportFormat } from '@screen-studio/types/export';

export function registerDialogHandlers(): void {
  ipcMain.handle(
    IpcChannels.ShowSaveExportDialog,
    async (event, defaultFileName: string, format: ExportFormat): Promise<string | null> => {
      const win = BrowserWindow.fromWebContents(event.sender);
      const options = {
        defaultPath: join(app.getPath('videos'), 'ScreenStudio', defaultFileName),
        filters: [{ name: format.toUpperCase(), extensions: [format] }]
      };
      const { canceled, filePath } = win
        ? await dialog.showSaveDialog(win, options)
        : await dialog.showSaveDialog(options);
      return canceled || !filePath ? null : filePath;
    }
  );
}
