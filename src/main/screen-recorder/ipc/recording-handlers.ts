import { app, ipcMain, shell } from 'electron';
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
import { windowBoundsPoller } from '../capture/window-bounds-poller';
import { supportsNativeSystemPicker } from '../security/display-media-handler';
import { parseWindowSourceId } from '@shared/window-source-id';
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

  // `followWindowId` is only passed for a 'window' source with no crop
  // region active (see useRecordingController.ts) -- when present, a poller
  // keeps re-querying that window's live bounds and rebasing the trackers
  // onto it, so dragging/resizing the recorded window mid-recording doesn't
  // leave cursor/click samples normalized against its stale start-of-
  // recording rect (see window-bounds-poller.ts).
  ipcMain.handle(
    IpcChannels.StartCursorTracking,
    (event, bounds: CursorTrackerBounds, startedAt: number, followWindowId: number | null) => {
      cursorTracker.start(event.sender, bounds, startedAt);
      clickTracker.start(event.sender, bounds, startedAt);
      if (followWindowId !== null) windowBoundsPoller.start(followWindowId);
    }
  );

  ipcMain.handle(IpcChannels.StopCursorTracking, () => {
    cursorTracker.stop();
    clickTracker.stop();
    windowBoundsPoller.stop();
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
      const windowId = parseWindowSourceId(sourceId);
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

  // Opens a recording that's no longer backed by an in-memory blob (e.g. a
  // sidebar "Recent" entry from a previous session) in the OS's default
  // player, since there's no persisted-project reload path yet -- see
  // ScreenRecorderSidebar.tsx.
  ipcMain.handle(IpcChannels.OpenRecordingFile, async (_event, filePath: string): Promise<void> => {
    const err = await shell.openPath(filePath);
    if (err) throw new Error(err);
  });

  // TODO: pause/resume handlers once the capture pipeline exists
}
