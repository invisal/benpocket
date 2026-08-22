import type { JSX } from 'react';
import { useMemo } from 'react';
import type {
  CursorSettings,
  CursorPathPoint,
  WindowResizeSample
} from '@screen-recorder/types/project';
import {
  resolveCursorStyle,
  CURSOR_SIZE_UNIT_PX,
  CURSOR_GESTURE_HOTSPOTS,
  CURSOR_CUSTOM_ICON_HOTSPOTS
} from '@shared/cursor-styles';
import { REFERENCE_CANVAS_WIDTH } from '@shared/constants';
import {
  smoothCursorPath,
  sampleCursorPath,
  resolveClickBounceScale,
  resolveClickRipple,
  resolveCursorGesture,
  resolveActiveResizeRotationDeg
} from '../engine/cursor-smoothing-engine';
import { CursorStyleIcon } from './CursorStyleIcon';

interface CursorOverlayProps {
  cursor: CursorSettings;
  rawPath: CursorPathPoint[];
  /** Recorded real mousedown events -- drives `cursor.clickBounce`. */
  clickPath: CursorPathPoint[];
  /** Real observed window-bounds changes (see window-bounds-poller.ts) -- lets resolveCursorGesture know for a fact when the tracked window is actually being resized. Only ever populated for a window-source recording with live bounds tracking. */
  resizePath: WindowResizeSample[];
  currentTimeMs: number;
  /** Rendered on-screen width of the whole stage (background + padding + content), i.e. `stageRef`'s rect -- the same reference frame webcam/annotations already scale against, see REFERENCE_CANVAS_WIDTH. */
  stageWidthPx: number;
  /** The clip currently under the playhead's own per-segment "Hide mouse cursor" flag (see CutTimeline.tsx's context menu) -- independent of `cursor.visible`, which hides it everywhere instead of just this one clip. */
  cursorHidden?: boolean;
}

/** Where the cursor renders when there's no recorded path to follow (see below). */
const PREVIEW_POSITION = { x: 0.5, y: 0.4 };

/**
 * Live editor approximation of what frame-compositor.ts's drawCursor bakes
 * into the export: same smoothing pass, position mapped as a 0-1 fraction of
 * the video's own content box (percentage-based, so it's exact regardless of
 * how the preview is scaled), and size scaled against `stageWidthPx` the same
 * way webcam/annotations scale -- so the cursor looks the same relative size
 * in the editor as it will in the exported video.
 *
 * With no recorded path (nothing captured yet, or a 'window' source that
 * can't be tracked) this still draws a static cursor at `PREVIEW_POSITION`
 * rather than rendering nothing -- otherwise the whole Cursor Style/Size
 * grid in the settings panel would have no visible effect until the user
 * had already recorded something with tracking data.
 */
export function CursorOverlay({
  cursor,
  rawPath,
  clickPath,
  resizePath,
  currentTimeMs,
  stageWidthPx,
  cursorHidden = false
}: CursorOverlayProps): JSX.Element | null {
  const smoothed = useMemo(
    () => smoothCursorPath(rawPath, cursor.smoothing),
    [rawPath, cursor.smoothing]
  );

  if (!cursor.visible || cursorHidden) return null;
  const point = rawPath.length > 0 ? sampleCursorPath(smoothed, currentTimeMs) : PREVIEW_POSITION;
  if (!point) return null;

  const preset = resolveCursorStyle(cursor.style);
  const scale = stageWidthPx / REFERENCE_CANVAS_WIDTH;
  const sizePx = cursor.size * CURSOR_SIZE_UNIT_PX * scale;
  const clickScale = resolveClickBounceScale(clickPath, currentTimeMs, cursor.clickBounce);
  // resolveCursorGesture can itself return 'hover' (stationary near a click,
  // gated by handGestureEnabled) or 'resize' (a real resize in progress --
  // see its own doc; always on, since it's a fact rather than a proxy).
  const gesture =
    rawPath.length > 0
      ? resolveCursorGesture(
          smoothed,
          clickPath,
          resizePath,
          currentTimeMs,
          cursor.handGestureEnabled
        )
      : 'idle';
  // Points along the cursor's actual recent direction of travel -- never a
  // fixed default -- only meaningful while `gesture === 'resize'`.
  const resizeRotationDeg =
    gesture !== 'resize' ? 0 : resolveActiveResizeRotationDeg(smoothed, resizePath, currentTimeMs);

  const hotspot =
    gesture === 'idle' && preset.customIcon
      ? CURSOR_CUSTOM_ICON_HOTSPOTS[preset.customIcon]
      : CURSOR_GESTURE_HOTSPOTS[gesture];
  const hotspotXPercent = (hotspot.x / 24) * 100;
  const hotspotYPercent = (hotspot.y / 24) * 100;
  const ripple = cursor.clickRippleEnabled
    ? resolveClickRipple(clickPath, currentTimeMs, cursor.clickBounce)
    : null;
  // Grows from ~1x to ~4x the icon's own size -- big enough to read clearly
  // next to a small cursor glyph without ever dwarfing the actual content.
  const rippleDiameterPx = ripple ? sizePx * (1 + ripple.progress * 3) : 0;

  return (
    <div
      className="pointer-events-none absolute inset-0 z-10"
      style={{ overflow: cursor.clipToCanvas ? 'hidden' : 'visible' }}
    >
      {ripple && (
        <div
          style={{
            position: 'absolute',
            left: `${ripple.pos.x * 100}%`,
            top: `${ripple.pos.y * 100}%`,
            width: rippleDiameterPx,
            height: rippleDiameterPx,
            transform: 'translate(-50%, -50%)',
            borderRadius: '9999px',
            border: `${Math.max(1.5, sizePx * 0.08)}px solid ${preset.fill}`,
            opacity: ripple.alpha
          }}
        />
      )}
      <div
        style={{
          position: 'absolute',
          left: `${point.x * 100}%`,
          top: `${point.y * 100}%`,
          filter: cursor.motionBlur > 0 ? `blur(${cursor.motionBlur * 1.5}px)` : undefined,
          // The icon's own hotspot (CURSOR_GESTURE_HOTSPOTS, in its 24x24
          // box -- the arrow/hand's corner tip, or the fist's topmost
          // knuckle for a drag) doesn't sit at the box's (0,0) corner -- the
          // translate pulls that point onto `point` (the actual recorded
          // position) instead of leaving the box's corner there, which was
          // rendering the glyph visibly offset from the true cursor/click
          // location. `rotate`/`scale` (applied second, around that same
          // origin) then handle the resize orientation and click-bounce
          // squash without disturbing the anchor -- rotate and a uniform
          // scale commute around a shared origin, so their relative order
          // here doesn't matter.
          transform: `translate(-${hotspotXPercent}%, -${hotspotYPercent}%) rotate(${resizeRotationDeg}deg)${clickScale !== 1 ? ` scale(${clickScale})` : ''}`,
          transformOrigin: `${hotspotXPercent}% ${hotspotYPercent}%`
        }}
      >
        <CursorStyleIcon
          fill={preset.fill}
          stroke={preset.stroke}
          size={sizePx}
          gesture={gesture}
          customIcon={preset.customIcon}
        />
      </div>
    </div>
  );
}
