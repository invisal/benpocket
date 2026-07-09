import type { JSX } from 'react';
import { useMemo } from 'react';
import type { CursorSettings, CursorPathPoint } from '@screen-recorder/types/project';
import { resolveCursorStyle, CURSOR_SIZE_UNIT_PX } from '@shared/cursor-styles';
import { REFERENCE_CANVAS_WIDTH } from '@shared/constants';
import { smoothCursorPath, sampleCursorPath } from '../engine/cursor-smoothing-engine';
import { CursorStyleIcon } from './CursorStyleIcon';

interface CursorOverlayProps {
  cursor: CursorSettings;
  rawPath: CursorPathPoint[];
  currentTimeMs: number;
  /** Rendered on-screen width of the whole stage (background + padding + content), i.e. `stageRef`'s rect -- the same reference frame webcam/annotations already scale against, see REFERENCE_CANVAS_WIDTH. */
  stageWidthPx: number;
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
  currentTimeMs,
  stageWidthPx
}: CursorOverlayProps): JSX.Element | null {
  const smoothed = useMemo(
    () => smoothCursorPath(rawPath, cursor.smoothing),
    [rawPath, cursor.smoothing]
  );

  if (!cursor.visible) return null;
  const point = rawPath.length > 0 ? sampleCursorPath(smoothed, currentTimeMs) : PREVIEW_POSITION;
  if (!point) return null;

  const preset = resolveCursorStyle(cursor.style);
  const scale = stageWidthPx / REFERENCE_CANVAS_WIDTH;
  const sizePx = cursor.size * CURSOR_SIZE_UNIT_PX * scale;

  return (
    <div
      className="pointer-events-none absolute inset-0 z-10"
      style={{ overflow: cursor.clipToCanvas ? 'hidden' : 'visible' }}
    >
      <div
        style={{
          position: 'absolute',
          left: `${point.x * 100}%`,
          top: `${point.y * 100}%`,
          filter: cursor.motionBlur > 0 ? `blur(${cursor.motionBlur * 1.5}px)` : undefined
        }}
      >
        <CursorStyleIcon fill={preset.fill} stroke={preset.stroke} size={sizePx} />
      </div>
    </div>
  );
}
