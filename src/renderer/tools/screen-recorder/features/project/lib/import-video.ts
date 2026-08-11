import { toRecordingMediaUrl } from '@shared/media-protocol';
import { useAppStore } from '../../../app/app-store';
import { useZoomStore } from '../../zoom/store/zoom-store';
import { resetContentStoresForNewRecording } from './reset-content-stores-for-new-recording';

function baseNameWithoutExtension(filePath: string): string {
  const base = filePath.split(/[\\/]/).pop() ?? filePath;
  const dot = base.lastIndexOf('.');
  return dot > 0 ? base.slice(0, dot) : base;
}

/**
 * Sidebar's "Import" button: browse for an existing video file and load it
 * into the editor exactly like a freshly-stopped recording would (see
 * useRecordingController.ts's `stop()`) -- a `lastRecording` pointing at the
 * file in place (see `toRecordingMediaUrl`'s doc for why this isn't a
 * `readFileBytes` + Blob round trip) with no cursor/click/webcam data,
 * `currentProjectId` cleared so "Save" treats it as a new, unsaved project
 * rather than silently overwriting whatever was open before.
 */
export async function importVideoFile(): Promise<boolean> {
  const filePath = await window.screenRecorder.dialog.showOpenVideo();
  if (!filePath) return false;

  const previewUrl = toRecordingMediaUrl(filePath);
  const sizeBytes = await window.screenRecorder.export.getFileSize(filePath);

  useZoomStore.getState().setKeyframes([]);
  // Same reasoning as useRecordingController.ts's `stop()` -- an imported
  // video is a new, blank project too, so whatever the previously open
  // project's background/cursor/captions/annotations/blur-mask/crop stores
  // held must not carry over into this one.
  resetContentStoresForNewRecording();
  useAppStore.setState({
    currentProjectId: null,
    projectName: baseNameWithoutExtension(filePath),
    lastRecording: {
      previewUrl,
      filePath,
      sizeBytes,
      createdAt: Date.now(),
      cursorPath: [],
      clickPath: [],
      webcamPreviewUrl: null,
      webcamFilePath: null,
      webcamOffsetMs: 0,
      source: 'imported'
    }
  });
  useAppStore.getState().setRoute('editor');
  return true;
}
