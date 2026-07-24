import { app, ipcMain } from 'electron';
import { promises as fs } from 'fs';
import { join } from 'path';
import { IpcChannels } from '@shared/ipc-channels';
import type { RecordingRequest } from '@screen-recorder/types/recording';
import type {
  NativeRecordingRequest,
  NativeRecordingStartResult,
  NativeRecordingStopResult,
  NativeRecordingSupport
} from '@shared/native-capture';
import { listCaptureSources } from '../capture/screen-source-provider';
import { recordingController } from '../capture/recording-controller';
import { cursorTracker, type CursorTrackerBounds } from '../capture/cursor-tracker';
import { clickTracker } from '../capture/click-tracker';
import { supportsNativeSystemPicker } from '../security/display-media-handler';
import {
  checkNativeRecordingSupport,
  startNativeRecording,
  pauseNativeRecording,
  resumeNativeRecording,
  stopNativeRecording,
  getWindowBoundsById,
  type WindowBoundsResult
} from '../capture/native/recording-helper';

/** Same `~/Movies/ScreenRecorder/<fileName>` convention `SaveRecordingFile` already uses -- native recordings are written directly to their final home, no separate save step. */
function resolveRecordingOutputPath(extension: string): string {
  const dir = join(app.getPath('videos'), 'ScreenRecorder');
  return join(dir, `recording-${Date.now()}.${extension}`);
}

/** Electron's desktopCapturer embeds a window's native handle as `window:<handle>:0` -- the same id capture-engine.ts's toNativeRecordingSource() parses for the native recording helper's own target resolution. */
function parseWindowHandle(sourceId: string): number | null {
  const match = /^window:(\d+):/.exec(sourceId);
  if (!match) return null;
  const handle = Number(match[1]);
  return Number.isFinite(handle) ? handle : null;
}

export function registerRecordingHandlers(): void {
  ipcMain.handle(IpcChannels.GetCaptureSources, () => listCaptureSources());

  ipcMain.handle(IpcChannels.GetNativePickerSupport, () => supportsNativeSystemPicker());

  ipcMain.handle(IpcChannels.NativeRecordingCheckSupport, (): NativeRecordingSupport =>
    checkNativeRecordingSupport()
  );

  ipcMain.handle(
    IpcChannels.NativeRecordingStart,
    async (_event, request: NativeRecordingRequest): Promise<NativeRecordingStartResult> => {
      const dir = join(app.getPath('videos'), 'ScreenRecorder');
      await fs.mkdir(dir, { recursive: true });
      const outputPath = resolveRecordingOutputPath('mp4');
      return startNativeRecording({ ...request, outputPath });
    }
  );

  ipcMain.handle(IpcChannels.NativeRecordingPause, () => pauseNativeRecording());

  ipcMain.handle(IpcChannels.NativeRecordingResume, () => resumeNativeRecording());

  ipcMain.handle(IpcChannels.NativeRecordingStop, (): Promise<NativeRecordingStopResult> =>
    stopNativeRecording()
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

  // Re-resolves a window source's on-screen bounds right before recording
  // actually starts (see useRecordingController.ts) rather than trusting
  // whatever a `CaptureSource` was tagged with when the source list was
  // last loaded -- the window can easily have moved/resized since. Works
  // for any window, not just a hardcoded special case -- see
  // getWindowBoundsById's doc for why this replaced the old Simulator-only
  // AppleScript lookup.
  ipcMain.handle(
    IpcChannels.RefreshWindowBounds,
    (_event, sourceId: string): Promise<WindowBoundsResult | null> => {
      const windowId = parseWindowHandle(sourceId);
      if (windowId === null) return Promise.resolve(null);
      return getWindowBoundsById(windowId);
    }
  );

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
