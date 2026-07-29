import type { Project } from '@screen-recorder/types/project';
import { useAppStore } from '../../../app/app-store';
import { useTimelineStore } from '../../timeline/store/timeline-store';
import { useWebcamStore } from '../../webcam/store/webcam-store';
import { useBackgroundStore } from '../../background/store/background-store';
import { useCursorStore } from '../../cursor/store/cursor-store';
import { useZoomStore } from '../../zoom/store/zoom-store';
import { useAnnotationsStore } from '../../annotations/store/annotations-store';
import { useBlurMaskStore } from '../../blur-mask/store/blur-mask-store';
import { useCaptionsStore } from '../../captions/store/captions-store';
import { resetHistory } from '../../history/store/history-store';

/** Reads a local video file's bytes and wraps them as a blob URL, the same construction capture-engine.ts uses for its own native-recording read-back path. */
async function readAsVideoBlobUrl(filePath: string): Promise<{ url: string; sizeBytes: number }> {
  const bytes = await window.screenRecorder.export.readFileBytes(filePath);
  return {
    url: URL.createObjectURL(new Blob([bytes], { type: 'video/mp4' })),
    sizeBytes: bytes.byteLength
  };
}

/**
 * Hydrates every editor feature store from a loaded `Project` -- the reverse
 * of `build-project-snapshot.ts`. Reads the source (and webcam, if any)
 * video back into blob URLs since there's no live `Blob` for a project
 * loaded from disk, then bulk-applies each store's saved fields via
 * `.setState()` (no store exposes a matching bulk setter of its own).
 * Finishes by clearing undo/redo history and switching to the editor --
 * this is a session boundary exactly like a fresh recording loading in.
 */
export async function applyProjectSnapshot(project: Project): Promise<void> {
  const source = await readAsVideoBlobUrl(project.sourceVideoPath);
  const webcam = project.webcamVideoPath ? await readAsVideoBlobUrl(project.webcamVideoPath) : null;

  useTimelineStore.setState({
    tracks: project.tracks,
    sourceDurationMs: project.durationMs,
    skipNextAutoInit: true
  });
  useZoomStore.setState({
    keyframes: project.zoomKeyframes,
    armedKeyframeId: null,
    selectedKeyframeId: null
  });
  useWebcamStore.setState(project.webcam);
  useBackgroundStore.setState(project.background);
  useCursorStore.setState(project.cursor);
  useCaptionsStore.setState(project.captions);
  useAnnotationsStore.setState({ annotations: project.annotations, selectedAnnotationId: null });
  useBlurMaskStore.setState({ regions: project.blurMasks, selectedRegionId: null });

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
      webcamOffsetMs: project.webcamOffsetMs
    }
  });

  resetHistory();
  useAppStore.getState().setRoute('editor');
}
