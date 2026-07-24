import type { Project } from '@screen-recorder/types/project';
import { REFERENCE_CANVAS_WIDTH } from '@shared/constants';
import { findWallpaperPreset } from '@shared/wallpaper-presets';
import { sampleCursorPath, resolveClickBounceScale } from '@shared/cursor-path';
import type { CursorPathPoint } from '@shared/cursor-path';
import { resolveCursorStyle, CURSOR_SIZE_UNIT_PX } from '@shared/cursor-styles';
import { resolveZoom } from '@shared/zoom-resolve';
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
      const preset = findWallpaperPreset(background.value);
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
    offsetYPx: intensity * 0.3 * scale,
    alpha: 0.15 + (intensity / 100) * 0.45
  };
}

function resolveCursor(
  project: Project,
  smoothedPath: CursorPathPoint[],
  innerRect: InnerRect,
  referenceScale: number,
  atMs: number
): CursorSceneData | null {
  const { cursor, clickPath } = project;
  if (!cursor.visible || smoothedPath.length === 0) return null;
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

  return {
    posPx: toPx(point),
    sizePx,
    fill: preset.fill,
    stroke: preset.stroke,
    clickScale: resolveClickBounceScale(clickPath, atMs, cursor.clickBounce),
    clipToCanvas: cursor.clipToCanvas,
    ghosts
  };
}

function resolveWebcam(project: Project, referenceScale: number): WebcamSceneData | null {
  if (!project.webcam.enabled) return null;
  const { webcam } = project;
  return {
    xPx: webcam.position.x * referenceScale,
    yPx: webcam.position.y * referenceScale,
    sizePx: webcam.size * referenceScale,
    shape: webcam.shape,
    mirrored: webcam.mirrored
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
    if (atMs < annotation.atMs || atMs > annotation.atMs + annotation.durationMs) continue;
    const xPx = annotation.position.x * referenceScale;
    const yPx = annotation.position.y * referenceScale;

    if (annotation.kind === 'text') {
      active.push({
        kind: 'text',
        id: annotation.id,
        xPx,
        yPx,
        text: annotation.text,
        fontPx: Math.round(28 * referenceScale)
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
        scale: referenceScale
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
 * `smoothedCursorPath` is precomputed once per export (smoothing doesn't
 * depend on `atMs`) and passed in rather than recomputed every frame.
 * `sourceAspect` is the recording's (post-crop) aspect ratio -- the caller
 * (export-orchestrator.ts) already derives this once from ffprobe + the
 * first kept segment's crop, same as today's export-manager.ts did.
 */
export function evaluateSceneAtMs(
  project: Project,
  atMs: number,
  outputWidth: number,
  outputHeight: number,
  sourceAspect: number,
  smoothedCursorPath: CursorPathPoint[]
): SceneDescription {
  const innerRect = computeInnerRect(
    outputWidth,
    outputHeight,
    sourceAspect,
    project.background.padding
  );
  const referenceScale = outputWidth / REFERENCE_CANVAS_WIDTH;
  const cornerRadiusPx = project.background.cornerRadius * referenceScale;

  const zoom = resolveZoom(atMs, project.zoomKeyframes, smoothedCursorPath);
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
    cursor: resolveCursor(project, smoothedCursorPath, innerRect, referenceScale, atMs),
    blurMasks: resolveBlurMasks(project, innerRect, atMs),
    webcam: resolveWebcam(project, referenceScale),
    annotations: resolveAnnotations(project, referenceScale, atMs),
    caption: resolveCaption(project, atMs)
  };
}
