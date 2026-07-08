import type { JSX } from 'react';
import { useCallback, useRef, useState } from 'react';
import type { CropRect } from '@screen-studio/types/timeline';
import { useTimelineStore, PRIMARY_VIDEO_TRACK_ID } from '../../timeline/store/timeline-store';
import { cn } from '../../../lib/utils';

export type CropAspectId = 'free' | '16:9' | '9:16' | '1:1' | '4:3';

const ASPECT_OPTIONS: { id: CropAspectId; label: string; ratio: number | null }[] = [
  { id: 'free', label: 'Free', ratio: null },
  { id: '16:9', label: '16:9', ratio: 16 / 9 },
  { id: '9:16', label: '9:16', ratio: 9 / 16 },
  { id: '1:1', label: '1:1', ratio: 1 },
  { id: '4:3', label: '4:3', ratio: 4 / 3 }
];

const MIN_SIZE = 0.08;

type Corner = 'nw' | 'ne' | 'sw' | 'se';

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

/** Recomputes a rect centered at the same point, honoring `ratio` (source-pixel width/height). */
function centeredRectForAspect(
  current: CropRect,
  ratio: number | null,
  sourceWidth: number,
  sourceHeight: number
): CropRect {
  if (!ratio) return current;
  const cx = current.x + current.width / 2;
  const cy = current.y + current.height / 2;

  // Keep roughly the same area, just reshaped to the target ratio.
  const areaPx = current.width * sourceWidth * (current.height * sourceHeight);
  let widthPx = Math.sqrt(areaPx * ratio);
  let heightPx = widthPx / ratio;
  widthPx = Math.min(widthPx, sourceWidth);
  heightPx = Math.min(heightPx, sourceHeight);

  const width = widthPx / sourceWidth;
  const height = heightPx / sourceHeight;

  return {
    x: clamp01(Math.min(cx - width / 2, 1 - width)),
    y: clamp01(Math.min(cy - height / 2, 1 - height)),
    width,
    height
  };
}

interface CropOverlayProps {
  /** Which clip's own crop this overlay edits -- crop is per-clip, not global. */
  segmentId: string;
  sourceWidth: number;
  sourceHeight: number;
}

/**
 * Draggable/resizable crop rectangle over the preview video. The rect is
 * stored normalized (0-1) against the *source's* native pixel dimensions, on
 * the `segmentId` clip itself (timeline-store.ts's `setSegmentCrop`) -- each
 * cut clip can be framed differently. `sourceWidth`/`sourceHeight` are needed
 * to enforce aspect-ratio locks and interpret drags correctly regardless of
 * how large the preview itself is rendered on screen.
 *
 * The parent should remount this component (`key={segmentId}`) when the
 * selected clip changes so the local `aspect` UI state resets per clip.
 */
export function CropOverlay({
  segmentId,
  sourceWidth,
  sourceHeight
}: CropOverlayProps): JSX.Element {
  const rect = useTimelineStore(
    (s) =>
      s.tracks
        .find((t) => t.id === PRIMARY_VIDEO_TRACK_ID)
        ?.segments.find((seg) => seg.id === segmentId)?.crop ?? null
  );
  const setSegmentCrop = useTimelineStore((s) => s.setSegmentCrop);
  const setRect = useCallback(
    (next: CropRect | null) => setSegmentCrop(segmentId, next),
    [segmentId, setSegmentCrop]
  );
  const [aspect, setAspect] = useState<CropAspectId>('free');
  const reset = useCallback(() => {
    setSegmentCrop(segmentId, null);
    setAspect('free');
  }, [segmentId, setSegmentCrop]);

  const containerRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{
    mode: Corner | 'move';
    startClientX: number;
    startClientY: number;
    startRect: CropRect;
  } | null>(null);

  const effectiveRect: CropRect = rect ?? { x: 0.1, y: 0.1, width: 0.8, height: 0.8 };
  const ratio = ASPECT_OPTIONS.find((o) => o.id === aspect)?.ratio ?? null;

  const handlePointerMove = useCallback(
    (event: PointerEvent) => {
      const drag = dragState.current;
      const container = containerRef.current;
      if (!drag || !container) return;

      const bounds = container.getBoundingClientRect();
      const dx = (event.clientX - drag.startClientX) / bounds.width;
      const dy = (event.clientY - drag.startClientY) / bounds.height;
      const start = drag.startRect;

      let next: CropRect = { ...start };

      if (drag.mode === 'move') {
        next.x = clamp01(Math.min(start.x + dx, 1 - start.width));
        next.y = clamp01(Math.min(start.y + dy, 1 - start.height));
      } else {
        // Corner resize. Each corner moves two edges; the opposite corner
        // stays anchored in place.
        const movesLeft = drag.mode === 'nw' || drag.mode === 'sw';
        const movesTop = drag.mode === 'nw' || drag.mode === 'ne';

        let newX = movesLeft ? start.x + dx : start.x;
        let newY = movesTop ? start.y + dy : start.y;
        let newWidth = movesLeft ? start.width - dx : start.width + dx;
        let newHeight = movesTop ? start.height - dy : start.height + dy;

        if (ratio) {
          // Drive height from width so the locked ratio holds, in real
          // source-pixel terms (normalized width/height alone aren't
          // square, so the ratio must go through actual pixel dimensions).
          const widthPx = Math.max(newWidth * sourceWidth, 1);
          const heightPx = widthPx / ratio;
          newHeight = heightPx / sourceHeight;
          if (movesTop) newY = start.y + start.height - newHeight;
        }

        newWidth = Math.max(MIN_SIZE, newWidth);
        newHeight = Math.max(MIN_SIZE, newHeight);
        if (movesLeft) newX = start.x + start.width - newWidth;
        if (movesTop) newY = start.y + start.height - newHeight;
        newX = clamp01(Math.min(newX, 1 - newWidth));
        newY = clamp01(Math.min(newY, 1 - newHeight));

        next = { x: newX, y: newY, width: newWidth, height: newHeight };
      }

      setRect(next);
    },
    [ratio, setRect, sourceHeight, sourceWidth]
  );

  const stopDragging = useCallback(() => {
    dragState.current = null;
    window.removeEventListener('pointermove', handlePointerMove);
  }, [handlePointerMove]);

  const startDragging =
    (mode: Corner | 'move') =>
    (event: React.PointerEvent): void => {
      event.preventDefault();
      event.stopPropagation();
      dragState.current = {
        mode,
        startClientX: event.clientX,
        startClientY: event.clientY,
        startRect: effectiveRect
      };
      if (!rect) setRect(effectiveRect);
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', stopDragging, { once: true });
    };

  function selectAspect(id: CropAspectId): void {
    setAspect(id);
    const preset = ASPECT_OPTIONS.find((o) => o.id === id);
    if (preset?.ratio && sourceWidth > 0 && sourceHeight > 0) {
      setRect(centeredRectForAspect(effectiveRect, preset.ratio, sourceWidth, sourceHeight));
    }
  }

  const corners: Corner[] = ['nw', 'ne', 'sw', 'se'];

  return (
    <div ref={containerRef} className="absolute inset-0">
      {/* Dimmed area outside the crop rect, built from 4 rects around it
          rather than a single overlay so the rect itself stays click-through
          to the video underneath (e.g. for play/pause). */}
      <div
        className="absolute inset-x-0 top-0 bg-black/60"
        style={{ height: `${effectiveRect.y * 100}%` }}
      />
      <div
        className="absolute inset-x-0 bottom-0 bg-black/60"
        style={{ height: `${(1 - effectiveRect.y - effectiveRect.height) * 100}%` }}
      />
      <div
        className="absolute bg-black/60"
        style={{
          top: `${effectiveRect.y * 100}%`,
          height: `${effectiveRect.height * 100}%`,
          left: 0,
          width: `${effectiveRect.x * 100}%`
        }}
      />
      <div
        className="absolute bg-black/60"
        style={{
          top: `${effectiveRect.y * 100}%`,
          height: `${effectiveRect.height * 100}%`,
          right: 0,
          width: `${(1 - effectiveRect.x - effectiveRect.width) * 100}%`
        }}
      />

      <div
        onPointerDown={startDragging('move')}
        className="absolute cursor-move border-2 border-accent"
        style={{
          left: `${effectiveRect.x * 100}%`,
          top: `${effectiveRect.y * 100}%`,
          width: `${effectiveRect.width * 100}%`,
          height: `${effectiveRect.height * 100}%`
        }}
      >
        {/* Rule-of-thirds guide lines */}
        <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="border border-white/20" />
          ))}
        </div>

        {corners.map((corner) => (
          <div
            key={corner}
            onPointerDown={startDragging(corner)}
            className={cn(
              'absolute h-3.5 w-3.5 rounded-full border-2 border-accent bg-surface',
              corner === 'nw' &&
                'left-0 top-0 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize',
              corner === 'ne' &&
                'right-0 top-0 translate-x-1/2 -translate-y-1/2 cursor-nesw-resize',
              corner === 'sw' &&
                'bottom-0 left-0 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize',
              corner === 'se' &&
                'bottom-0 right-0 translate-x-1/2 translate-y-1/2 cursor-nwse-resize'
            )}
          />
        ))}
      </div>

      <div className="pointer-events-auto absolute left-2 top-2 flex gap-1 rounded-lg bg-black/70 p-1">
        {ASPECT_OPTIONS.map((option) => (
          <button
            key={option.id}
            onClick={() => selectAspect(option.id)}
            className={cn(
              'rounded px-2 py-1 text-[11px] font-medium',
              aspect === option.id ? 'bg-accent text-surface' : 'text-white/70 hover:bg-white/10'
            )}
          >
            {option.label}
          </button>
        ))}
        <button
          onClick={reset}
          className="rounded px-2 py-1 text-[11px] font-medium text-white/50 hover:bg-white/10"
        >
          Reset
        </button>
      </div>
    </div>
  );
}
