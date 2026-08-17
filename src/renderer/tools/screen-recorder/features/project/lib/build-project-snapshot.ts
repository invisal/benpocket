import type { Project } from '@screen-recorder/types/project';
import { useScreenRecorderStore } from '../../../store/screen-recorder-store';
import { useTimelineStore } from '../../timeline/store/timeline-store';
import { useWebcamStore } from '../../webcam/store/webcam-store';
import { useBackgroundStore } from '../../background/store/background-store';
import { useCursorStore } from '../../cursor/store/cursor-store';
import { useZoomStore } from '../../zoom/store/zoom-store';
import { useAnnotationsStore } from '../../annotations/store/annotations-store';
import { useBlurMaskStore } from '../../blur-mask/store/blur-mask-store';
import { useCaptionsStore } from '../../captions/store/captions-store';
import { useCropStore } from '../../crop/store/crop-store';

/**
 * Assembles a full `Project` snapshot from the live editor stores for
 * `project:save` -- unlike `buildExportProject` (which only needs enough to
 * render, so it hardcodes `tracks: []`), a saved project must round-trip the
 * actual cuts, so `tracks` comes from timeline-store here.
 */
export function buildProjectSnapshot(name: string): Project | null {
  const { lastRecording, currentProjectId } = useScreenRecorderStore.getState();
  if (!lastRecording?.filePath) return null;

  const { tracks, sourceDurationMs } = useTimelineStore.getState();
  const webcamState = useWebcamStore.getState();
  const backgroundState = useBackgroundStore.getState();
  const cursorState = useCursorStore.getState();
  const { keyframes: zoomKeyframes } = useZoomStore.getState();
  const { annotations } = useAnnotationsStore.getState();
  const { regions: blurMasks } = useBlurMaskStore.getState();
  const captionsState = useCaptionsStore.getState();
  const { rect: crop } = useCropStore.getState();

  const now = Date.now();

  return {
    id: currentProjectId ?? crypto.randomUUID(),
    name,
    createdAt: now,
    updatedAt: now,
    source: lastRecording.source,
    sourceVideoPath: lastRecording.filePath,
    durationMs: sourceDurationMs,
    tracks,
    zoomKeyframes,
    webcam: {
      enabled: webcamState.enabled,
      shape: webcamState.shape,
      mirrored: webcamState.mirrored,
      position: webcamState.position,
      size: webcamState.size,
      shadow: webcamState.shadow
    },
    webcamVideoPath: lastRecording.webcamFilePath,
    webcamOffsetMs: lastRecording.webcamOffsetMs,
    background: {
      enabled: backgroundState.enabled,
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
    cursorPath: lastRecording.cursorPath,
    clickPath: lastRecording.clickPath,
    captions: {
      enabled: captionsState.enabled,
      language: captionsState.language,
      segments: captionsState.segments
    },
    annotations,
    blurMasks,
    motionBlur: false,
    crop
  };
}
