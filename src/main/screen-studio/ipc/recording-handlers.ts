import { app, ipcMain } from 'electron';
import { promises as fs } from 'fs';
import { join } from 'path';
import { IpcChannels } from '@shared/ipc-channels';
import type { RecordingRequest } from '@screen-studio/types/recording';
import { listCaptureSources } from '../capture/screen-source-provider';
import { recordingController } from '../capture/recording-controller';

export function registerRecordingHandlers(): void {
  ipcMain.handle(IpcChannels.GetCaptureSources, () => listCaptureSources());

  ipcMain.handle(IpcChannels.StartRecording, (_event, request: RecordingRequest) =>
    recordingController.start(request)
  );

  ipcMain.handle(IpcChannels.StopRecording, () => recordingController.stop());

  // The actual capture (getUserMedia + MediaRecorder) happens in the
  // renderer -- see features/recording/engine/capture-engine.ts -- because
  // MediaRecorder is a browser API with no main-process equivalent. Once the
  // renderer has a finished Blob it hands the raw bytes to this handler to
  // persist to disk.
  ipcMain.handle(
    IpcChannels.SaveRecordingFile,
    async (_event, fileName: string, data: ArrayBuffer): Promise<string> => {
      const dir = join(app.getPath('videos'), 'ScreenStudio');
      await fs.mkdir(dir, { recursive: true });
      const filePath = join(dir, fileName);
      await fs.writeFile(filePath, Buffer.from(data));
      return filePath;
    }
  );

  // TODO: pause/resume handlers once the capture pipeline exists
}
