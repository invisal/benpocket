import type { Project } from '@screen-recorder/types/project';
import { REFERENCE_CANVAS_WIDTH } from '@shared/constants';
import { findWallpaperPreset } from '@shared/wallpaper-presets';
import { enrichWallpaperPreset } from '../../../background/lib/wave-wallpaper';
import { findWallpaperImagePreset } from '../../../background/lib/wallpaper-images';
import { resolveTextEntrance } from '../../../annotations/presets/text-animation-presets';
import {
  TEXT_BACKGROUND_PADDING_X,
  TEXT_BACKGROUND_PADDING_Y,
  TEXT_BACKGROUND_RADIUS
} from '../../../annotations/store/annotations-store';
import {
  sampleCursorPath,
  resolveClickBounceScale,
  resolveClickRipple,
  resolveCursorGesture
} from '@shared/cursor-path';
import type { CursorPathPoint } from '@shared/cursor-path';
import { resolveCursorStyle, CURSOR_SIZE_UNIT_PX } from '@shared/cursor-styles';
import { resolveZoom } from '@shared/zoom-resolve';
import { clampWebcamPosition } from '@shared/webcam-position';
import { computeInnerRect } from './inner-rect';
import type {
  AnnotationSceneData,
  BackgroundSceneData,
  BlurMaskSceneData,
  CursorGhostSceneData,
  CursorSceneData,
  InnerRect,
  SceneDescription,
  ShadowSceneData,
  WebcamSceneData
} from './types';

function resolveBackground(project: Project): BackgroundSceneData {
  const { background } = project;
  switch (background.kind) {
    case 'color':
      return { kind: 'color', color: background.value };
    case 'gradient': {
      const [angleDeg = '180', color1 = '#000000', color2 = '#000000'] =
        background.value.split('|');
      return { kind: 'linear-gradient', angleDeg: Number(angleDeg), colors: [color1, color2] };
    }
    case 'wallpaper': {
      const imagePreset = findWallpaperImagePreset(background.value);
      if (imagePreset) return { kind: 'image', path: imagePreset.src, blurPx: 0 };
      const preset = enrichWallpaperPreset(findWallpaperPreset(background.value));
      return preset.type === 'wave'
        ? { kind: 'radial-blobs', backgroundColor: preset.backgroundColor, blobs: preset.blobs }
        : { kind: 'linear-gradient', angleDeg: preset.angleDeg, colors: preset.colors };
    }
    case 'image':
      return { kind: 'image', path: background.value, blurPx: background.blur };
  }
}

function resolveShadow(intensity: number, scale: number): ShadowSceneData | null {
  if (intensity <= 0) return null;
  return {
    radiusPx: 0, // filled in by caller (shares cornerRadiusPx)
    blurPx: intensity * 0.7 * scale,
    spreadPx: intensity * 0.3 * scale,
    alpha: 0.15 + (intensity / 100) * 0.45
  };
}

function resolveCursor(
  project: Project,
  smoothedPath: CursorPathPoint[],
  innerRect: InnerRect,
  referenceScale: number,
  atMs: number,
  cursorHidden: boolean
): CursorSceneData | null {
  const { cursor, clickPath } = project;
  // Imported footage has no recorded cursor/click samples -- `smoothedPath`
  // is already always empty for it, but check `source` explicitly too
  // rather than relying only on that being incidentally true.
  if (project.source === 'imported' || !cursor.visible || cursorHidden || smoothedPath.length === 0)
    return null;
  const point = sampleCursorPath(smoothedPath, atMs);
  if (!point) return null;

  const sizePx = cursor.size * CURSOR_SIZE_UNIT_PX * referenceScale;
  const preset = resolveCursorStyle(cursor.style);
  const toPx = (p: { x: number; y: number }): { x: number; y: number } => ({
    x: innerRect.x + p.x * innerRect.width,
    y: innerRect.y + p.y * innerRect.height
  });

  const ghosts: CursorGhostSceneData[] = [];
  if (cursor.motionBlur > 0) {
    const ghostCount = 4;
    for (let i = ghostCount; i >= 1; i--) {
      const ghostAtMs = atMs - i * 14 * cursor.motionBlur;
      const ghostPoint = sampleCursorPath(smoothedPath, ghostAtMs);
      if (!ghostPoint) continue;
      ghosts.push({
        posPx: toPx(ghostPoint),
        alpha: cursor.motionBlur * 0.12 * (1 - i / (ghostCount + 1))
      });
    }
  }

  const ripple = cursor.clickRippleEnabled
    ? resolveClickRipple(clickPath, atMs, cursor.clickBounce)
    : null;

  return {
    posPx: toPx(point),
    sizePx,
    fill: preset.fill,
    stroke: preset.stroke,
    clickScale: resolveClickBounceScale(clickPath, atMs, cursor.clickBounce),
    clipToCanvas: cursor.clipToCanvas,
    gesture: cursor.handGestureEnabled
      ? resolveCursorGesture(smoothedPath, clickPath, atMs)
      : 'idle',
    customIcon: preset.customIcon,
    ghosts,
    // Grows from ~1x to ~4x the icon's own size -- same formula as
    // CursorOverlay.tsx's live-preview ripple, so the export matches.
    ripple: ripple
      ? {
          posPx: toPx(ripple.pos),
          radiusPx: (sizePx * (1 + ripple.progress * 3)) / 2,
          alpha: ripple.alpha
        }
      : null
  };
}

function resolveWebcam(
  project: Project,
  referenceScale: number,
  referenceHeight: number,
  webcamHidden: boolean
): WebcamSceneData | null {
  if (!project.webcam.enabled || webcamHidden) return null;
  const { webcam } = project;
  // Same clamp the live preview applies (see `clampWebcamPosition`'s own
  // doc) -- keeps a position that only reads as out-of-bounds because the
  // project's aspect ratio changed since it was last set from exporting a
  // webcam that's invisible in the editor's own preview too.
  const position = clampWebcamPosition(webcam.position, webcam.size, referenceHeight);
  return {
    xPx: position.x * referenceScale,
    yPx: position.y * referenceScale,
    sizePx: webcam.size * referenceScale,
    shape: webcam.shape,
    mirrored: webcam.mirrored,
    shadow: resolveShadow(webcam.shadow, referenceScale)
  };
}

function resolveBlurMasks(
  project: Project,
  innerRect: InnerRect,
  atMs: number
): BlurMaskSceneData[] {
  const active: BlurMaskSceneData[] = [];
  for (const region of project.blurMasks) {
    if (atMs < region.atMs || atMs > region.atMs + region.durationMs) continue;
    const widthPx = region.rect.width * innerRect.width;
    const heightPx = region.rect.height * innerRect.height;
    if (widthPx <= 0 || heightPx <= 0) continue;
    active.push({
      shape: region.shape,
      kind: region.kind,
      xPx: innerRect.x + region.rect.x * innerRect.width,
      yPx: innerRect.y + region.rect.y * innerRect.height,
      widthPx,
      heightPx,
      color: region.kind === 'mask' ? region.color : '',
      blurPx: region.kind === 'blur' ? region.intensity : 0
    });
  }
  return active;
}

function resolveAnnotations(
  project: Project,
  referenceScale: number,
  atMs: number
): AnnotationSceneData[] {
  const active: AnnotationSceneData[] = [];
  for (const annotation of project.annotations) {
    if (!annotation.enabled) continue;
    if (atMs < annotation.atMs || atMs > annotation.atMs + annotation.durationMs) continue;
    const xPx = annotation.position.x * referenceScale;
    const yPx = annotation.position.y * referenceScale;

    if (annotation.kind === 'text') {
      const entrance = resolveTextEntrance(
        annotation.animationPreset,
        atMs - annotation.atMs,
        annotation.animationSpeed,
        annotation.durationMs,
        annotation.text
      );
      active.push({
        kind: 'text',
        id: annotation.id,
        xPx,
        yPx: yPx + entrance.offsetY * referenceScale,
        text: entrance.revealedText,
        fontPx: Math.round(annotation.fontSize * referenceScale),
        color: annotation.color,
        backgroundColor: annotation.backgroundColor,
        backgroundPaddingXPx: TEXT_BACKGROUND_PADDING_X * referenceScale,
        backgroundPaddingYPx: TEXT_BACKGROUND_PADDING_Y * referenceScale,
        backgroundRadiusPx: TEXT_BACKGROUND_RADIUS * referenceScale,
        alpha: entrance.alpha,
        scale: entrance.scale
      });
    } else if (annotation.kind === 'arrow') {
      active.push({
        kind: 'arrow',
        id: annotation.id,
        x1: xPx,
        y1: yPx,
        x2: annotation.to.x * referenceScale,
        y2: annotation.to.y * referenceScale,
        color: annotation.color,
        lineWidthPx: Math.max(2, annotation.thickness * referenceScale),
        headLengthPx: 14 * referenceScale,
        dashed: annotation.style === 'dashed'
      });
    } else {
      active.push({
        kind: 'image',
        id: annotation.id,
        xPx,
        yPx,
        assetPath: annotation.assetPath,
        scale: referenceScale,
        sizePx: annotation.size
          ? {
              width: annotation.size.width * referenceScale,
              height: annotation.size.height * referenceScale
            }
          : null
      });
    }
  }
  return active;
}

function resolveCaption(project: Project, atMs: number): { text: string } | null {
  if (!project.captions.enabled) return null;
  const segment = project.captions.segments.find((s) => atMs >= s.startMs && atMs <= s.endMs);
  return segment ? { text: segment.text } : null;
}

/**
 * Pure "what should be on screen at `atMs`" evaluation -- no PixiJS, no I/O.
 * `smoothedCursorPath`/`autoZoomFocalPaths` are precomputed once per export
 * (neither depends on `atMs`) and passed in rather than recomputed every
 * frame -- deliberately two *different* things over the same raw path, not
 * one shared one: `smoothedCursorPath` (the user's own `CursorSettings.
 * smoothing`) draws the cursor icon, while `autoZoomFocalPaths` (one
 * deadzone-camera-simulated path per 'auto-cursor' keyframe, see
 * computeAutoZoomFocalPath in zoom-resolve.ts) drives the zoom camera's
 * focal point -- panning the whole zoomed viewport needs to hold still for
 * small movements and only pan once the cursor nears the edge of what's
 * visible, or auto-zoom visibly snaps/re-centers on every movement instead
 * of gliding the way Screen Studio's camera does. `sourceAspect` is the
 * recording's (post-crop) aspect ratio -- the caller (export-
 * orchestrator.ts) already derives this once from ffprobe + the export's
 * single crop, same as today's export-manager.ts did. `cursorHidden`
 * comes from the specific `ExportSegment` currently being decoded/rendered
 * (its own per-clip "Hide mouse cursor" flag, see CutTimeline.tsx) -- the
 * caller already has it on hand from the same decode callback that supplies
 * `atMs`, so it's passed straight through rather than re-derived here.
 * `webcamHidden` is the same idea for that segment's "Hide webcam" flag.
 */
export function evaluateSceneAtMs(
  project: Project,
  atMs: number,
  outputWidth: number,
  outputHeight: number,
  sourceAspect: number,
  smoothedCursorPath: CursorPathPoint[],
  autoZoomFocalPaths: Map<string, CursorPathPoint[]>,
  cursorHidden: boolean,
  webcamHidden: boolean
): SceneDescription {
  const innerRect = computeInnerRect(
    outputWidth,
    outputHeight,
    sourceAspect,
    project.background.padding
  );
  const referenceScale = outputWidth / REFERENCE_CANVAS_WIDTH;
  const cornerRadiusPx = project.background.cornerRadius * referenceScale;

  const zoom = resolveZoom(atMs, project.zoomKeyframes, autoZoomFocalPaths);
  const shadow = resolveShadow(project.background.shadow, referenceScale);
  if (shadow) shadow.radiusPx = cornerRadiusPx;

  return {
    outputWidth,
    outputHeight,
    innerRect,
    cornerRadiusPx,
    referenceScale,
    background: resolveBackground(project),
    shadow,
    zoom,
    cursor: resolveCursor(
      project,
      smoothedCursorPath,
      innerRect,
      referenceScale,
      atMs,
      cursorHidden
    ),
    blurMasks: resolveBlurMasks(project, innerRect, atMs),
    webcam: resolveWebcam(
      project,
      referenceScale,
      REFERENCE_CANVAS_WIDTH / (outputWidth / outputHeight),
      webcamHidden
    ),
    annotations: resolveAnnotations(project, referenceScale, atMs),
    caption: resolveCaption(project, atMs)
  };
}
