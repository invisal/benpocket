import { useAppStore } from '../../../app/app-store';
import { useZoomStore } from '../../zoom/store/zoom-store';

const MIME_TYPES_BY_EXTENSION: Record<string, string> = {
  webm: 'video/webm',
  mov: 'video/quicktime',
  mkv: 'video/x-matroska',
  m4v: 'video/mp4',
  mp4: 'video/mp4'
};

function mimeTypeForVideoPath(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
  return MIME_TYPES_BY_EXTENSION[ext] ?? 'video/mp4';
}

function baseNameWithoutExtension(filePath: string): string {
  const base = filePath.split(/[\\/]/).pop() ?? filePath;
  const dot = base.lastIndexOf('.');
  return dot > 0 ? base.slice(0, dot) : base;
}

/**
 * Sidebar's "Import" button: browse for an existing video file and load it
 * into the editor exactly like a freshly-stopped recording would (see
 * useRecordingController.ts's `stop()`) -- a blob-URL `lastRecording` with
 * no cursor/click/webcam data, `currentProjectId` cleared so "Save" treats
 * it as a new, unsaved project rather than silently overwriting whatever
 * was open before.
 */
export async function importVideoFile(): Promise<boolean> {
  const filePath = await window.screenRecorder.dialog.showOpenVideo();
  if (!filePath) return false;

  const bytes = await window.screenRecorder.export.readFileBytes(filePath);
  const previewUrl = URL.createObjectURL(
    new Blob([bytes], { type: mimeTypeForVideoPath(filePath) })
  );

  useZoomStore.getState().setKeyframes([]);
  useAppStore.setState({
    currentProjectId: null,
    projectName: baseNameWithoutExtension(filePath),
    lastRecording: {
      previewUrl,
      filePath,
      sizeBytes: bytes.byteLength,
      createdAt: Date.now(),
      cursorPath: [],
      clickPath: [],
      webcamPreviewUrl: null,
      webcamFilePath: null,
      webcamOffsetMs: 0
    }
  });
  useAppStore.getState().setRoute('editor');
  return true;
}
