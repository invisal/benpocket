import type { Project } from '@screen-recorder/types/project';
import { toRecordingMediaUrl } from '@shared/media-protocol';
import { useAppStore } from '../../../app/app-store';
import { useTimelineStore } from '../../timeline/store/timeline-store';
import { useWebcamStore } from '../../webcam/store/webcam-store';
import { useBackgroundStore } from '../../background/store/background-store';
import { useCursorStore } from '../../cursor/store/cursor-store';
import { useZoomStore } from '../../zoom/store/zoom-store';
import { useAnnotationsStore } from '../../annotations/store/annotations-store';
import { useBlurMaskStore } from '../../blur-mask/store/blur-mask-store';
import { useCaptionsStore } from '../../captions/store/captions-store';
import { useCropStore } from '../../crop/store/crop-store';
import { resetHistory } from '../../history/store/history-store';

/** Points the editor at a project video file in place -- see `toRecordingMediaUrl`'s doc for why this isn't a `readFileBytes` + Blob round trip. */
async function toVideoSource(filePath: string): Promise<{ url: string; sizeBytes: number }> {
  return {
    url: toRecordingMediaUrl(filePath),
    sizeBytes: await window.screenRecorder.export.getFileSize(filePath)
  };
}

/**
 * Hydrates every editor feature store from a loaded `Project` -- the reverse
 * of `build-project-snapshot.ts`. Points the source (and webcam, if any)
 * video back at their on-disk paths, then bulk-applies each store's saved
 * fields via `.setState()` (no store exposes a matching bulk setter of its
 * own). Finishes by clearing undo/redo history and switching to the editor
 * -- this is a session boundary exactly like a fresh recording loading in.
 */
export async function applyProjectSnapshot(project: Project): Promise<void> {
  const source = await toVideoSource(project.sourceVideoPath);
  const webcam = project.webcamVideoPath ? await toVideoSource(project.webcamVideoPath) : null;

  useTimelineStore.setState({
    tracks: project.tracks,
    sourceDurationMs: project.durationMs,
    skipNextAutoInit: true
  });
  useZoomStore.setState({
    keyframes: project.zoomKeyframes,
    selectedKeyframeId: null
  });
  useWebcamStore.setState(project.webcam);
  useBackgroundStore.setState(project.background);
  useCursorStore.setState(project.cursor);
  useCaptionsStore.setState(project.captions);
  useAnnotationsStore.setState({ annotations: project.annotations, selectedAnnotationId: null });
  useBlurMaskStore.setState({ regions: project.blurMasks, selectedRegionId: null });
  // `?? null`, not just `project.crop` -- projects saved before `crop` existed
  // on `Project` have no such key at all, so this also guards against
  // inheriting a stale crop left over from whatever was open before this one.
  useCropStore.setState({ rect: project.crop ?? null });

  useAppStore.setState({
    projectName: project.name,
    currentProjectId: project.id,
    lastRecording: {
      previewUrl: source.url,
      filePath: project.sourceVideoPath,
      sizeBytes: source.sizeBytes,
      createdAt: project.createdAt,
      cursorPath: project.cursorPath,
      clickPath: project.clickPath,
      webcamPreviewUrl: webcam?.url ?? null,
      webcamFilePath: project.webcamVideoPath,
      webcamOffsetMs: project.webcamOffsetMs,
      // Legacy project JSONs predate this field -- see project-handlers.ts's
      // `ListProjects` for why the missing case defaults to 'imported'.
      source: project.source ?? 'imported'
    }
  });

  resetHistory();
  useAppStore.getState().setRoute('editor');
}
