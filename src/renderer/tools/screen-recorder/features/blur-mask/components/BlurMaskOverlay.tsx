import type { JSX } from 'react';
import { useCallback, useEffect, useRef } from 'react';
import type { BlurMaskRegion } from '@screen-recorder/types/project';
import type { CropRect } from '@screen-recorder/types/timeline';
import { REFERENCE_CANVAS_WIDTH } from '@shared/constants';
import { useBlurMaskStore } from '../store/blur-mask-store';
import { beginGesture, endGesture } from '../../history/store/history-store';
import { cn } from '../../../lib/utils';

const MIN_SIZE = 0.04;

type Corner = 'nw' | 'ne' | 'sw' | 'se';

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

function isActive(atMs: number, region: BlurMaskRegion): boolean {
  return atMs >= region.atMs && atMs <= region.atMs + region.durationMs;
}

interface BlurMaskOverlayProps {
  currentTimeMs: number;
  /** Whether drag/resize handles are shown -- only while the Blur/Mask tool panel is the active tool, so the redaction effect itself (always rendered) doesn't sprout draggable chrome during normal playback. */
  editable: boolean;
  /** Rendered on-screen width of the whole stage -- same reference frame cursor/webcam/annotations scale against, for sizing the blur radius consistently. */
  stageWidthPx: number;
}

/**
 * Live editor approximation of what frame-compositor.ts's drawBlurMasks
 * bakes into the export. Rendered inside PreviewStage's zoom-transformed
 * video wrapper (like CursorOverlay/CropOverlay) so regions track panned/
 * zoomed content -- `rect` is normalized (0-1) against the video's own box,
 * same convention as `CropRect`. Unlike CropOverlay this uses real CSS
 * `backdrop-filter: blur()` / a solid fill for the actual redaction effect
 * (not just a canvas approximation), so scrubbing shows genuinely blurred/
 * masked content, not merely a placeholder box.
 */
export function BlurMaskOverlay({
  currentTimeMs,
  editable,
  stageWidthPx
}: BlurMaskOverlayProps): JSX.Element {
  const regions = useBlurMaskStore((s) => s.regions);
  const selectedRegionId = useBlurMaskStore((s) => s.selectedRegionId);
  const setSelectedRegionId = useBlurMaskStore((s) => s.setSelectedRegionId);
  const updateRegion = useBlurMaskStore((s) => s.updateRegion);

  const containerRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{
    regionId: string;
    mode: Corner | 'move';
    startClientX: number;
    startClientY: number;
    startRect: CropRect;
  } | null>(null);

  const handlePointerMove = useCallback(
    (event: PointerEvent) => {
      const drag = dragState.current;
      const container = containerRef.current;
      if (!drag || !container) return;

      const bounds = container.getBoundingClientRect();
      const dx = (event.clientX - drag.startClientX) / bounds.width;
      const dy = (event.clientY - drag.startClientY) / bounds.height;
      const start = drag.startRect;

      let next: CropRect;
      if (drag.mode === 'move') {
        next = {
          ...start,
          x: clamp01(Math.min(start.x + dx, 1 - start.width)),
          y: clamp01(Math.min(start.y + dy, 1 - start.height))
        };
      } else {
        const movesLeft = drag.mode === 'nw' || drag.mode === 'sw';
        const movesTop = drag.mode === 'nw' || drag.mode === 'ne';

        let newX = movesLeft ? start.x + dx : start.x;
        let newY = movesTop ? start.y + dy : start.y;
        const newWidth = Math.max(MIN_SIZE, movesLeft ? start.width - dx : start.width + dx);
        const newHeight = Math.max(MIN_SIZE, movesTop ? start.height - dy : start.height + dy);
        if (movesLeft) newX = start.x + start.width - newWidth;
        if (movesTop) newY = start.y + start.height - newHeight;
        newX = clamp01(Math.min(newX, 1 - newWidth));
        newY = clamp01(Math.min(newY, 1 - newHeight));

        next = { x: newX, y: newY, width: newWidth, height: newHeight };
      }

      updateRegion(drag.regionId, { rect: next });
    },
    [updateRegion]
  );

  const stopDragging = useCallback(() => {
    if (dragState.current) endGesture();
    dragState.current = null;
    window.removeEventListener('pointermove', handlePointerMove);
  }, [handlePointerMove]);

  // Guards against the pointerup listener never firing (this overlay
  // unmounts mid-drag, e.g. the Blur/Mask tool gets deselected) -- otherwise
  // the gesture it opened would stay open forever, silently swallowing
  // every undo-tracked change made afterward.
  useEffect(() => stopDragging, [stopDragging]);

  const startDragging = useCallback(
    (regionId: string, mode: Corner | 'move', startRect: CropRect) =>
      (event: React.PointerEvent): void => {
        event.preventDefault();
        event.stopPropagation();
        setSelectedRegionId(regionId);
        beginGesture();
        dragState.current = {
          regionId,
          mode,
          startClientX: event.clientX,
          startClientY: event.clientY,
          startRect
        };
        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', stopDragging, { once: true });
      },
    [handlePointerMove, stopDragging, setSelectedRegionId]
  );

  const scale = stageWidthPx > 0 ? stageWidthPx / REFERENCE_CANVAS_WIDTH : 1;
  const active = regions.filter((r) => isActive(currentTimeMs, r));
  const corners: Corner[] = ['nw', 'ne', 'sw', 'se'];

  return (
    <div ref={containerRef} className="absolute inset-0">
      {active.map((region) => {
        const isSelected = selectedRegionId === region.id;
        return (
          <div
            key={region.id}
            onPointerDown={editable ? startDragging(region.id, 'move', region.rect) : undefined}
            onClick={() => editable && setSelectedRegionId(region.id)}
            className={cn(
              'absolute',
              // The redaction effect itself always renders (it's not an
              // editing affordance), but only captures pointer events while
              // the Blur/Mask tool is active -- otherwise it would block
              // clicks meant for the play button/scrub area underneath.
              editable ? 'pointer-events-auto cursor-move' : 'pointer-events-none',
              editable && isSelected && 'ring-2 ring-accent'
            )}
            style={{
              left: `${region.rect.x * 100}%`,
              top: `${region.rect.y * 100}%`,
              width: `${region.rect.width * 100}%`,
              height: `${region.rect.height * 100}%`,
              borderRadius: region.shape === 'ellipse' ? '50%' : undefined,
              overflow: region.shape === 'ellipse' ? 'hidden' : undefined,
              backdropFilter:
                region.kind === 'blur' ? `blur(${region.intensity * scale}px)` : undefined,
              WebkitBackdropFilter:
                region.kind === 'blur' ? `blur(${region.intensity * scale}px)` : undefined,
              background: region.kind === 'mask' ? region.color : undefined
            }}
          >
            {editable && isSelected && (
              <>
                <div className="pointer-events-none absolute inset-0 border-2 border-accent" />
                {corners.map((corner) => (
                  <div
                    key={corner}
                    onPointerDown={startDragging(region.id, corner, region.rect)}
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
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
