import { app, ipcMain } from 'electron';
import { promises as fs } from 'fs';
import { join } from 'path';
import { IpcChannels } from '@shared/ipc-channels';
import { copyFileToClipboard } from '../clipboard/copy-file-to-clipboard';

/**
 * The export pipeline itself (demux/decode/render/encode/mux) runs entirely
 * in the renderer -- a plain Worker using WebCodecs + PixiJS + mediabunny, no
 * ffmpeg subprocess, no nodeIntegration. Main's role is raw file-IO: read the
 * source video's bytes in (for the WASM demuxer), write the finished
 * export's bytes out (to the path chosen via dialog.showSaveExportPath, or a
 * temp path for "copy to clipboard"), and, for the clipboard case, write
 * that temp file's path to the OS clipboard as a file reference.
 */
export function registerExportHandlers(): void {
  ipcMain.handle(
    IpcChannels.ExportReadFileBytes,
    async (_event, filePath: string): Promise<ArrayBuffer> => {
      const buffer = await fs.readFile(filePath);
      return buffer.buffer.slice(
        buffer.byteOffset,
        buffer.byteOffset + buffer.byteLength
      ) as ArrayBuffer;
    }
  );

  ipcMain.handle(
    IpcChannels.ExportWriteFileBytes,
    async (_event, filePath: string, data: ArrayBuffer): Promise<void> => {
      await fs.writeFile(filePath, Buffer.from(data));
    }
  );

  // "Copy to clipboard" exports to a temp file first (same pipeline as a
  // normal file export, see useExportAction's handleCopyToClipboard), then
  // copies that path to the clipboard below -- these two handlers back that.
  ipcMain.handle(IpcChannels.ExportGetTempPath, (_event, fileName: string): string => {
    return join(app.getPath('temp'), fileName);
  });

  ipcMain.handle(
    IpcChannels.ExportCopyToClipboard,
    async (_event, filePath: string): Promise<void> => {
      await copyFileToClipboard(filePath);
    }
  );
}
