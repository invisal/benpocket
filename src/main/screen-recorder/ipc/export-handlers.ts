import { ipcMain } from 'electron';
import { promises as fs } from 'fs';
import { IpcChannels } from '@shared/ipc-channels';

/**
 * The export pipeline itself (demux/decode/render/encode/mux) runs entirely
 * in the renderer -- a plain Worker using WebCodecs + PixiJS + mediabunny, no
 * ffmpeg subprocess, no nodeIntegration. Main's only role is these two raw
 * file-IO primitives: read the source video's bytes in (for the WASM
 * demuxer), write the finished export's bytes out (to the path already
 * chosen via dialog.showSaveExportPath).
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
}
