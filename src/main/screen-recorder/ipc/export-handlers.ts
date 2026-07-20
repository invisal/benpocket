import { ipcMain } from 'electron';
import { IpcChannels } from '@shared/ipc-channels';
import type { ExportOptions } from '@screen-recorder/types/export';
import { runExportInWorkerWindow } from '../windows/export-worker-window';

export function registerExportHandlers(): void {
  ipcMain.handle(IpcChannels.ExportVideo, (event, options: ExportOptions) =>
    runExportInWorkerWindow(options, (progress) => {
      event.sender.send(IpcChannels.ExportProgress, progress);
    })
  );
}
