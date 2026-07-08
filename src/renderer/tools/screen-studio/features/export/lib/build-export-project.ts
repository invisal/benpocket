import type { Project } from '@screen-studio/types/project';
import { useAppStore } from '../../../app/app-store';
import { useWebcamStore } from '../../webcam/store/webcam-store';
import { useBackgroundStore } from '../../background/store/background-store';
import { useCursorStore } from '../../cursor/store/cursor-store';
import { useZoomStore } from '../../zoom/store/zoom-store';
import { useAnnotationsStore } from '../../annotations/store/annotations-store';
import { useCaptionsStore } from '../../captions/store/captions-store';

/**
 * Assembles a `Project` snapshot from the live editor stores at export time.
 * There is no persisted Project object today (project:open/save are stubs),
 * so this is the only place the shared Project shape gets populated.
 */
export function buildExportProject(sourceVideoPath: string, durationMs: number): Project {
  const { projectName } = useAppStore.getState();
  const webcamState = useWebcamStore.getState();
  const backgroundState = useBackgroundStore.getState();
  const cursorState = useCursorStore.getState();
  const { keyframes: zoomKeyframes } = useZoomStore.getState();
  const { annotations } = useAnnotationsStore.getState();
  const captionsState = useCaptionsStore.getState();

  const now = Date.now();

  return {
    id: crypto.randomUUID(),
    name: projectName,
    createdAt: now,
    updatedAt: now,
    sourceVideoPath,
    durationMs,
    tracks: [],
    zoomKeyframes,
    webcam: {
      enabled: webcamState.enabled,
      shape: webcamState.shape,
      mirrored: webcamState.mirrored,
      position: webcamState.position,
      size: webcamState.size
    },
    background: {
      kind: backgroundState.kind,
      value: backgroundState.value,
      padding: backgroundState.padding,
      blur: backgroundState.blur
    },
    cursor: {
      theme: cursorState.theme,
      size: cursorState.size,
      smoothing: cursorState.smoothing,
      clickEffect: cursorState.clickEffect
    },
    captions: {
      enabled: captionsState.enabled,
      language: captionsState.language,
      segments: captionsState.segments
    },
    annotations,
    motionBlur: false
  };
}
