import { ipcMain } from 'electron';
import { IpcChannels } from '@shared/ipc-channels';
import type { ExportOptions } from '@screen-studio/types/export';
import { exportManager } from '../export/export-manager';

export function registerExportHandlers(): void {
  ipcMain.handle(IpcChannels.ExportVideo, (event, options: ExportOptions) =>
    exportManager.export(options, (progress) => {
      event.sender.send(IpcChannels.ExportProgress, progress);
    })
  );
}
