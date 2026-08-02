import type { JSX } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Crop as CropIcon, RotateCcw } from 'lucide-react';
import type { CropRect } from '@screen-recorder/types/timeline';
import { Dialog } from '@renderer/components/ui/Dialog';
import { Button } from '@renderer/components/ui/Button';
import { Select } from '@renderer/components/ui/Select';
import { useCropStore } from '../store/crop-store';
import { beginGesture, endGesture } from '../../history/store/history-store';
import { cn } from '../../../lib/utils';

type CropAspectId = 'free' | '16:9' | '9:16' | '1:1' | '4:3';

const ASPECT_OPTIONS: { id: CropAspectId; label: string; ratio: number | null }[] = [
  { id: 'free', label: 'Any', ratio: null },
  { id: '16:9', label: '16:9', ratio: 16 / 9 },
  { id: '9:16', label: '9:16', ratio: 9 / 16 },
  { id: '1:1', label: '1:1', ratio: 1 },
  { id: '4:3', label: '4:3', ratio: 4 / 3 }
];

const MIN_SIZE = 0.08;
const DEFAULT_RECT: CropRect = { x: 0, y: 0, width: 1, height: 1 };

type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w';

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

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

/** A number input that only commits on blur/Enter, so mid-typing states don't get clamped away as you type -- same pattern as ClipSettingsPanel's `TimeField`. */
function NumberField({
  label,
  valuePx,
  onCommit
}: {
  label: string;
  valuePx: number;
  onCommit: (px: number) => void;
}): JSX.Element {
  const rounded = Math.round(valuePx);
  return (
    <label className="flex items-center gap-1.5 rounded-md bg-surface px-2 py-1">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <input
        type="number"
        defaultValue={rounded}
        key={rounded}
        onBlur={(e) => {
          const next = Number(e.target.value);
          if (Number.isFinite(next)) onCommit(next);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
        className="w-16 min-w-0 bg-transparent text-[12px] text-foreground outline-none"
      />
    </label>
  );
}

interface CropDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceWidth: number;
  sourceHeight: number;
  previewUrl: string;
  /** Where to pause the dialog's own preview frame -- the editor's current scrub position, so the crop is framed against whatever's actually on screen right now. */
  currentTimeMs: number;
}

/**
 * Modal crop editor -- opened from the Crop button in `EditorTransportBar`,
 * replacing the old always-inline `CropOverlay`. Everything here works
 * against a local *draft* rect, never touching the real store until
 * "Confirm changes" -- unlike the old overlay, which wrote to the crop store
 * on every drag frame. "Discard changes" (or dismissing the dialog any other
 * way) just closes without committing.
 *
 * A single crop applies to the whole recording (`useCropStore`), not
 * per-clip. Remounted (`key` at the call site, keyed off `open`) each time
 * it opens, so the draft always starts from the current committed crop.
 */
export function CropDialog({
  open,
  onOpenChange,
  sourceWidth,
  sourceHeight,
  previewUrl,
  currentTimeMs
}: CropDialogProps): JSX.Element {
  const crop = useCropStore((s) => s.rect);
  const setCrop = useCropStore((s) => s.setCrop);
  const [draftRect, setDraftRect] = useState<CropRect>(crop ?? DEFAULT_RECT);
  const [aspect, setAspect] = useState<CropAspectId>('free');

  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const dragState = useRef<{
    mode: ResizeHandle | 'move';
    startClientX: number;
    startClientY: number;
    startRect: CropRect;
  } | null>(null);

  // Pause the dialog's own preview at the position being edited, once its
  // metadata is ready to seek -- a fresh, independent `<video>` rather than
  // reusing PreviewStage's dual-video elements, since this only ever shows
  // one static frame and doesn't need any of that playback machinery.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    function seekToCurrentFrame(): void {
      if (video) video.currentTime = currentTimeMs / 1000;
    }
    video.addEventListener('loadedmetadata', seekToCurrentFrame);
    return () => video.removeEventListener('loadedmetadata', seekToCurrentFrame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        // Resize. The 4 corners move two edges at once; the 4 N/S/E/W
        // midpoint handles move just one -- whichever edge(s) a handle
        // owns, the opposite edge(s) stay anchored in place.
        const movesLeft = drag.mode === 'nw' || drag.mode === 'sw' || drag.mode === 'w';
        const movesRight = drag.mode === 'ne' || drag.mode === 'se' || drag.mode === 'e';
        const movesTop = drag.mode === 'nw' || drag.mode === 'ne' || drag.mode === 'n';
        const movesBottom = drag.mode === 'sw' || drag.mode === 'se' || drag.mode === 's';

        let newWidth = movesLeft ? start.width - dx : movesRight ? start.width + dx : start.width;
        let newHeight = movesTop
          ? start.height - dy
          : movesBottom
            ? start.height + dy
            : start.height;

        if (ratio) {
          // Drive whichever dimension isn't directly being dragged, in real
          // source-pixel terms (normalized width/height alone aren't
          // square, so the ratio must go through actual pixel dimensions) --
          // width drives height for a left/right/corner drag; a pure
          // top/bottom edge drag has nothing else touching width, so it's
          // height driving width instead.
          if (movesLeft || movesRight) {
            const widthPx = Math.max(newWidth * sourceWidth, 1);
            newHeight = widthPx / ratio / sourceHeight;
          } else if (movesTop || movesBottom) {
            const heightPx = Math.max(newHeight * sourceHeight, 1);
            newWidth = (heightPx * ratio) / sourceWidth;
          }
        }

        // Cap each dimension at exactly how much room its anchored
        // (opposite) edge leaves -- rather than only clamping position
        // afterward, which let the rect keep growing past the container
        // while just pinning position to 0/1, silently overflowing the
        // preview.
        const maxWidth = movesLeft ? start.x + start.width : movesRight ? 1 - start.x : start.width;
        const maxHeight = movesTop
          ? start.y + start.height
          : movesBottom
            ? 1 - start.y
            : start.height;
        newWidth = Math.min(Math.max(MIN_SIZE, newWidth), maxWidth);
        newHeight = Math.min(Math.max(MIN_SIZE, newHeight), maxHeight);

        const newX = movesLeft ? start.x + start.width - newWidth : start.x;
        const newY = movesTop ? start.y + start.height - newHeight : start.y;

        next = {
          x: clamp01(Math.min(newX, 1 - newWidth)),
          y: clamp01(Math.min(newY, 1 - newHeight)),
          width: newWidth,
          height: newHeight
        };
      }

      setDraftRect(next);
    },
    [ratio, sourceHeight, sourceWidth]
  );

  const stopDragging = useCallback(() => {
    dragState.current = null;
    window.removeEventListener('pointermove', handlePointerMove);
  }, [handlePointerMove]);

  useEffect(() => stopDragging, [stopDragging]);

  const startDragging = useCallback(
    (mode: ResizeHandle | 'move') =>
      (event: React.PointerEvent): void => {
        event.preventDefault();
        event.stopPropagation();
        dragState.current = {
          mode,
          startClientX: event.clientX,
          startClientY: event.clientY,
          startRect: draftRect
        };
        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', stopDragging, { once: true });
      },
    [draftRect, handlePointerMove, stopDragging]
  );

  function selectAspect(id: CropAspectId): void {
    setAspect(id);
    const preset = ASPECT_OPTIONS.find((o) => o.id === id);
    if (preset?.ratio && sourceWidth > 0 && sourceHeight > 0) {
      setDraftRect(centeredRectForAspect(draftRect, preset.ratio, sourceWidth, sourceHeight));
    }
  }

  function handleResetRect(): void {
    setDraftRect(DEFAULT_RECT);
    setAspect('free');
  }

  function commitSize(dimension: 'width' | 'height', px: number): void {
    const sourceDim = dimension === 'width' ? sourceWidth : sourceHeight;
    const normalized = clamp01(px / sourceDim);
    setDraftRect((r) => {
      const maxForPos = 1 - r[dimension === 'width' ? 'x' : 'y'];
      return { ...r, [dimension]: Math.max(MIN_SIZE, Math.min(normalized, maxForPos)) };
    });
  }

  function commitPosition(axis: 'x' | 'y', px: number): void {
    const sourceDim = axis === 'x' ? sourceWidth : sourceHeight;
    const normalized = clamp01(px / sourceDim);
    setDraftRect((r) => {
      const maxPos = 1 - r[axis === 'x' ? 'width' : 'height'];
      return { ...r, [axis]: Math.max(0, Math.min(normalized, maxPos)) };
    });
  }

  function handleConfirm(): void {
    beginGesture();
    setCrop(draftRect);
    endGesture();
    onOpenChange(false);
  }

  // 4 corners (resize two edges at once) + 4 edge midpoints (resize one).
  const handles: { id: ResizeHandle; className: string }[] = [
    { id: 'nw', className: 'left-0 top-0 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize' },
    { id: 'ne', className: 'right-0 top-0 translate-x-1/2 -translate-y-1/2 cursor-nesw-resize' },
    { id: 'sw', className: 'bottom-0 left-0 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize' },
    { id: 'se', className: 'bottom-0 right-0 translate-x-1/2 translate-y-1/2 cursor-nwse-resize' },
    { id: 'n', className: 'left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 cursor-ns-resize' },
    { id: 's', className: 'left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2 cursor-ns-resize' },
    { id: 'w', className: 'left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize' },
    { id: 'e', className: 'right-0 top-1/2 translate-x-1/2 -translate-y-1/2 cursor-ew-resize' }
  ];

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange} disablePointerDismissal>
      <Dialog.Content
        size="large"
        className="max-w-4xl rounded-xl"
        backdropClassName="backdrop-blur-xs"
        showClose={false}
      >
        <div className="flex flex-col gap-3">
          <Dialog.Title className="flex items-center gap-2">
            <CropIcon size={15} /> Crop
          </Dialog.Title>

          <div className="flex flex-wrap items-center gap-3 rounded-lg bg-surface-2 px-3 py-2">
            <span className="text-[11px] font-medium text-muted-foreground">Size</span>
            <div className="flex items-center gap-1">
              <NumberField
                label="W"
                valuePx={draftRect.width * sourceWidth}
                onCommit={(px) => commitSize('width', px)}
              />
              <span className="text-[11px] text-muted-foreground">×</span>
              <NumberField
                label="H"
                valuePx={draftRect.height * sourceHeight}
                onCommit={(px) => commitSize('height', px)}
              />
            </div>

            <Select.Root
              value={aspect}
              onValueChange={(value) => selectAspect(value as CropAspectId)}
            >
              <Select.Trigger size="sm">
                {ASPECT_OPTIONS.find((o) => o.id === aspect)?.label}
              </Select.Trigger>
              <Select.Content>
                {ASPECT_OPTIONS.map((option) => (
                  <Select.Item key={option.id} value={option.id}>
                    {option.label}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select.Root>

            <span className="ml-2 text-[11px] font-medium text-muted-foreground">Position</span>
            <div className="flex items-center gap-1">
              <NumberField
                label="X"
                valuePx={draftRect.x * sourceWidth}
                onCommit={(px) => commitPosition('x', px)}
              />
              <NumberField
                label="Y"
                valuePx={draftRect.y * sourceHeight}
                onCommit={(px) => commitPosition('y', px)}
              />
            </div>

            <Button variant="ghost" size="sm" className="ml-auto" onClick={handleResetRect}>
              <RotateCcw size={12} /> Reset
            </Button>
          </div>

          <div
            ref={containerRef}
            className="relative overflow-hidden rounded-lg border border-border-dark bg-black"
            style={{ aspectRatio: sourceWidth / sourceHeight }}
          >
            <video
              ref={videoRef}
              src={previewUrl}
              muted
              playsInline
              className="pointer-events-none h-full w-full object-contain"
            />

            {/* Dimmed area outside the crop rect, built from 4 rects around it
                rather than a single overlay so the rect itself stays
                click-through to nothing underneath it (there's nothing
                interactive under a paused reference frame, but this keeps
                the same structure `CropOverlay` used). */}
            <div
              className="absolute inset-x-0 top-0 bg-black/60"
              style={{ height: `${draftRect.y * 100}%` }}
            />
            <div
              className="absolute inset-x-0 bottom-0 bg-black/60"
              style={{ height: `${(1 - draftRect.y - draftRect.height) * 100}%` }}
            />
            <div
              className="absolute bg-black/60"
              style={{
                top: `${draftRect.y * 100}%`,
                height: `${draftRect.height * 100}%`,
                left: 0,
                width: `${draftRect.x * 100}%`
              }}
            />
            <div
              className="absolute bg-black/60"
              style={{
                top: `${draftRect.y * 100}%`,
                height: `${draftRect.height * 100}%`,
                right: 0,
                width: `${(1 - draftRect.x - draftRect.width) * 100}%`
              }}
            />

            <div
              onPointerDown={startDragging('move')}
              className="absolute cursor-move border-2 border-accent"
              style={{
                left: `${draftRect.x * 100}%`,
                top: `${draftRect.y * 100}%`,
                width: `${draftRect.width * 100}%`,
                height: `${draftRect.height * 100}%`
              }}
            >
              <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3">
                {Array.from({ length: 9 }).map((_, i) => (
                  <div key={i} className="border border-white/20" />
                ))}
              </div>

              {handles.map((handle) => (
                <div
                  key={handle.id}
                  onPointerDown={startDragging(handle.id)}
                  className={cn(
                    'absolute h-3.5 w-3.5 rounded-full border-2 border-accent bg-surface',
                    handle.className
                  )}
                />
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Discard changes
            </Button>
            <Button variant="primary" onClick={handleConfirm}>
              Confirm changes
            </Button>
          </div>
        </div>
      </Dialog.Content>
    </Dialog.Root>
  );
}
