import type { Project } from '@screen-recorder/types/project';
import { useAppStore } from '../../../app/app-store';
import { useWebcamStore } from '../../webcam/store/webcam-store';
import { useBackgroundStore } from '../../background/store/background-store';
import { useCursorStore } from '../../cursor/store/cursor-store';
import { useZoomStore } from '../../zoom/store/zoom-store';
import { useAnnotationsStore } from '../../annotations/store/annotations-store';
import { useBlurMaskStore } from '../../blur-mask/store/blur-mask-store';
import { useCaptionsStore } from '../../captions/store/captions-store';

/**
 * Assembles a `Project` snapshot from the live editor stores at export time.
 * `crop` is deliberately left `null` here -- `useExportAction.ts` reads
 * `useCropStore` directly and passes it as its own top-level argument to
 * `runExport`, alongside (not inside) this `Project`, since the export
 * pipeline needs it before rendering starts, not as part of the timeline
 * content this snapshot otherwise describes.
 */
export function buildExportProject(sourceVideoPath: string, durationMs: number): Project {
  const { projectName, lastRecording } = useAppStore.getState();
  const webcamState = useWebcamStore.getState();
  const backgroundState = useBackgroundStore.getState();
  const cursorState = useCursorStore.getState();
  const { keyframes: zoomKeyframes } = useZoomStore.getState();
  const { annotations } = useAnnotationsStore.getState();
  const { regions: blurMasks } = useBlurMaskStore.getState();
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
    webcamVideoPath: lastRecording?.webcamFilePath ?? null,
    webcamOffsetMs: lastRecording?.webcamOffsetMs ?? 0,
    background: {
      kind: backgroundState.kind,
      value: backgroundState.value,
      padding: backgroundState.padding,
      blur: backgroundState.blur,
      cornerRadius: backgroundState.cornerRadius,
      shadow: backgroundState.shadow
    },
    cursor: {
      visible: cursorState.visible,
      clipToCanvas: cursorState.clipToCanvas,
      style: cursorState.style,
      size: cursorState.size,
      smoothing: cursorState.smoothing,
      motionBlur: cursorState.motionBlur,
      clickBounce: cursorState.clickBounce,
      clickRippleEnabled: cursorState.clickRippleEnabled,
      handGestureEnabled: cursorState.handGestureEnabled
    },
    cursorPath: lastRecording?.cursorPath ?? [],
    clickPath: lastRecording?.clickPath ?? [],
    captions: {
      enabled: captionsState.enabled,
      language: captionsState.language,
      segments: captionsState.segments
    },
    annotations,
    blurMasks,
    motionBlur: false,
    crop: null
  };
}
