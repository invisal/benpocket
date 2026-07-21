import { app, ipcMain } from 'electron';
import { promises as fs } from 'fs';
import { join } from 'path';
import { IpcChannels } from '@shared/ipc-channels';
import type { RecordingRequest } from '@screen-recorder/types/recording';
import { listCaptureSources } from '../capture/screen-source-provider';
import { recordingController } from '../capture/recording-controller';
import { cursorTracker, type CursorTrackerBounds } from '../capture/cursor-tracker';
import { clickTracker } from '../capture/click-tracker';
import {
  supportsNativeSystemPicker,
  setPendingCaptureSourceId
} from '../security/display-media-handler';

export function registerRecordingHandlers(): void {
  ipcMain.handle(IpcChannels.GetCaptureSources, () => listCaptureSources());

  ipcMain.handle(IpcChannels.GetNativePickerSupport, () => supportsNativeSystemPicker());

  ipcMain.handle(IpcChannels.PrepareDisplayMediaCapture, (_event, sourceId: string) =>
    setPendingCaptureSourceId(sourceId)
  );

  ipcMain.handle(
    IpcChannels.StartCursorTracking,
    (event, bounds: CursorTrackerBounds, startedAt: number) => {
      cursorTracker.start(event.sender, bounds, startedAt);
      clickTracker.start(event.sender, bounds, startedAt);
    }
  );

  ipcMain.handle(IpcChannels.StopCursorTracking, () => {
    cursorTracker.stop();
    clickTracker.stop();
  });

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
      const dir = join(app.getPath('videos'), 'ScreenRecorder');
      await fs.mkdir(dir, { recursive: true });
      const filePath = join(dir, fileName);
      await fs.writeFile(filePath, Buffer.from(data));
      return filePath;
    }
  );

  // "Remove" from the Library -- best-effort: a recording whose save
  // already failed (`filePath` null, see useRecordingController.stop) has
  // nothing on disk to remove, and a file that's already gone shouldn't
  // block clearing it from the UI either, so ENOENT is swallowed same as
  // success. Any other error (permissions, disk issue, ...) still surfaces
  // to the renderer, which leaves the item in the library rather than
  // silently pretending it's gone.
  ipcMain.handle(
    IpcChannels.DeleteRecordingFile,
    async (_event, filePath: string): Promise<void> => {
      try {
        await fs.unlink(filePath);
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
      }
    }
  );

  // TODO: pause/resume handlers once the capture pipeline exists
}
