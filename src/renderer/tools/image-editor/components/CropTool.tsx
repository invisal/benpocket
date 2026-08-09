import { useCallback, useRef, useState } from 'react';
import cn from 'cnfast';
import { Button } from '@renderer/components/ui/Button';
import { ImageCanvas } from './ImageCanvas';
import { FloatingToolbar } from './FloatingToolbar';
import { NumberField } from './NumberField';
import type { NormalizedRect, ToolPanelProps } from '../types';

type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w';
type CropAspectId = 'free' | '16:9' | '9:16' | '1:1' | '4:3';

const MIN_CROP_SIZE = 0.02;
const DEFAULT_RECT: NormalizedRect = { x: 0, y: 0, width: 1, height: 1 };

const ASPECT_OPTIONS: { id: CropAspectId; label: string; ratio: number | null }[] = [
  { id: 'free', label: 'Free', ratio: null },
  { id: '16:9', label: '16:9', ratio: 16 / 9 },
  { id: '9:16', label: '9:16', ratio: 9 / 16 },
  { id: '1:1', label: '1:1', ratio: 1 },
  { id: '4:3', label: '4:3', ratio: 4 / 3 }
];

const HANDLES: { id: ResizeHandle; className: string }[] = [
  { id: 'nw', className: 'left-0 top-0 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize' },
  { id: 'ne', className: 'right-0 top-0 translate-x-1/2 -translate-y-1/2 cursor-nesw-resize' },
  { id: 'sw', className: 'bottom-0 left-0 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize' },
  { id: 'se', className: 'bottom-0 right-0 translate-x-1/2 translate-y-1/2 cursor-nwse-resize' },
  { id: 'n', className: 'left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 cursor-ns-resize' },
  { id: 's', className: 'left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2 cursor-ns-resize' },
  { id: 'w', className: 'left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize' },
  { id: 'e', className: 'right-0 top-1/2 translate-x-1/2 -translate-y-1/2 cursor-ew-resize' }
];

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

function centeredRectForAspect(
  current: NormalizedRect,
  ratio: number | null,
  sourceWidth: number,
  sourceHeight: number
): NormalizedRect {
  if (!ratio) return current;
  const cx = current.x + current.width / 2;
  const cy = current.y + current.height / 2;

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

/**
 * Self-contained Crop tool: its own canvas, its own drag-handle overlay, and its own controls.
 * Only one tool is mounted at a time (see index.tsx), so the draft rect is plain local state --
 * this component starts fresh (full-frame) every time Crop becomes the active tool.
 */
export function CropTool({ imageData, onCommit, binary, mimeType }: ToolPanelProps) {
  const [rect, setRect] = useState<NormalizedRect>(DEFAULT_RECT);
  const [aspectId, setAspectId] = useState<CropAspectId>('free');
  const [isCropping, setIsCropping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const aspect = ASPECT_OPTIONS.find((o) => o.id === aspectId)?.ratio ?? null;

  const rootRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{
    mode: ResizeHandle | 'move';
    startClientX: number;
    startClientY: number;
    startRect: NormalizedRect;
  } | null>(null);

  const handlePointerMove = useCallback(
    (event: PointerEvent) => {
      const drag = dragState.current;
      const root = rootRef.current;
      if (!drag || !root) return;

      const bounds = root.getBoundingClientRect();
      const dx = (event.clientX - drag.startClientX) / bounds.width;
      const dy = (event.clientY - drag.startClientY) / bounds.height;
      const start = drag.startRect;

      let next: NormalizedRect = { ...start };

      if (drag.mode === 'move') {
        next.x = clamp01(Math.min(start.x + dx, 1 - start.width));
        next.y = clamp01(Math.min(start.y + dy, 1 - start.height));
      } else {
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

        if (aspect) {
          if (movesLeft || movesRight) {
            newHeight = newWidth / aspect;
          } else if (movesTop || movesBottom) {
            newWidth = newHeight * aspect;
          }
        }

        const maxWidth = movesLeft ? start.x + start.width : movesRight ? 1 - start.x : start.width;
        const maxHeight = movesTop
          ? start.y + start.height
          : movesBottom
            ? 1 - start.y
            : start.height;
        newWidth = Math.min(Math.max(MIN_CROP_SIZE, newWidth), maxWidth);
        newHeight = Math.min(Math.max(MIN_CROP_SIZE, newHeight), maxHeight);

        const newX = movesLeft ? start.x + start.width - newWidth : start.x;
        const newY = movesTop ? start.y + start.height - newHeight : start.y;

        next = {
          x: clamp01(Math.min(newX, 1 - newWidth)),
          y: clamp01(Math.min(newY, 1 - newHeight)),
          width: newWidth,
          height: newHeight
        };
      }

      setRect(next);
    },
    [aspect]
  );

  const stopDragging = useCallback(() => {
    dragState.current = null;
    window.removeEventListener('pointermove', handlePointerMove);
  }, [handlePointerMove]);

  const startDragging = useCallback(
    (mode: ResizeHandle | 'move') =>
      (event: React.PointerEvent): void => {
        event.preventDefault();
        event.stopPropagation();
        dragState.current = {
          mode,
          startClientX: event.clientX,
          startClientY: event.clientY,
          startRect: rect
        };
        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', stopDragging, { once: true });
      },
    [handlePointerMove, rect, stopDragging]
  );

  function selectAspect(id: CropAspectId): void {
    setAspectId(id);
    const preset = ASPECT_OPTIONS.find((o) => o.id === id);
    if (preset?.ratio) {
      setRect(centeredRectForAspect(rect, preset.ratio, imageData.width, imageData.height));
    }
  }

  function commitSize(dimension: 'width' | 'height', px: number): void {
    const sourceDim = dimension === 'width' ? imageData.width : imageData.height;
    const normalized = clamp01(px / sourceDim);
    const maxForPos = 1 - rect[dimension === 'width' ? 'x' : 'y'];
    setRect({ ...rect, [dimension]: Math.max(0.02, Math.min(normalized, maxForPos)) });
  }

  function commitPosition(axis: 'x' | 'y', px: number): void {
    const sourceDim = axis === 'x' ? imageData.width : imageData.height;
    const normalized = clamp01(px / sourceDim);
    const maxPos = 1 - rect[axis === 'x' ? 'width' : 'height'];
    setRect({ ...rect, [axis]: Math.max(0, Math.min(normalized, maxPos)) });
  }

  async function handleApply(): Promise<void> {
    const x = rect.x * imageData.width;
    const y = rect.y * imageData.height;
    const w = rect.width * imageData.width;
    const h = rect.height * imageData.height;

    setIsCropping(true);
    setError(null);
    try {
      // One round trip: sharp decodes `binary`, extracts the rect, and re-encodes to `mimeType`.
      // `onCommit` hands the result straight to `ImageTool`, which decodes it for display -- no
      // decoding here.
      const result = await window.imageEditor.crop(binary, x, y, w, h, mimeType);
      if ('error' in result) throw new Error(result.error);
      onCommit(new Uint8Array(result.data));
      setRect(DEFAULT_RECT);
      setAspectId('free');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsCropping(false);
    }
  }

  const isFullFrame = rect.x === 0 && rect.y === 0 && rect.width === 1 && rect.height === 1;

  return (
    <div className="relative flex h-full min-h-0 w-full">
      <ImageCanvas imageData={imageData}>
        <div ref={rootRef} className="absolute inset-0">
          <div
            className="absolute inset-x-0 top-0 bg-black/60"
            style={{ height: `${rect.y * 100}%` }}
          />
          <div
            className="absolute inset-x-0 bottom-0 bg-black/60"
            style={{ height: `${(1 - rect.y - rect.height) * 100}%` }}
          />
          <div
            className="absolute bg-black/60"
            style={{
              top: `${rect.y * 100}%`,
              height: `${rect.height * 100}%`,
              left: 0,
              width: `${rect.x * 100}%`
            }}
          />
          <div
            className="absolute bg-black/60"
            style={{
              top: `${rect.y * 100}%`,
              height: `${rect.height * 100}%`,
              right: 0,
              width: `${(1 - rect.x - rect.width) * 100}%`
            }}
          />

          <div
            onPointerDown={startDragging('move')}
            className="absolute cursor-move border-2 border-accent"
            style={{
              left: `${rect.x * 100}%`,
              top: `${rect.y * 100}%`,
              width: `${rect.width * 100}%`,
              height: `${rect.height * 100}%`
            }}
          >
            <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3">
              {Array.from({ length: 9 }).map((_, i) => (
                <div key={i} className="border border-white/20" />
              ))}
            </div>

            {HANDLES.map((handle) => (
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
      </ImageCanvas>

      <FloatingToolbar>
        <NumberField
          label="W"
          value={rect.width * imageData.width}
          onCommit={(px) => commitSize('width', px)}
        />
        <NumberField
          label="H"
          value={rect.height * imageData.height}
          onCommit={(px) => commitSize('height', px)}
        />
        <NumberField
          label="X"
          value={rect.x * imageData.width}
          onCommit={(px) => commitPosition('x', px)}
        />
        <NumberField
          label="Y"
          value={rect.y * imageData.height}
          onCommit={(px) => commitPosition('y', px)}
        />
        <div className="flex items-center gap-0.5">
          {ASPECT_OPTIONS.map((option) => (
            <button
              key={option.id}
              onClick={() => selectAspect(option.id)}
              className={cn(
                'rounded px-2 py-1 text-[11px]',
                aspectId === option.id
                  ? 'bg-accent/15 text-accent'
                  : 'text-muted-foreground hover:bg-surface-3'
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
        <Button
          size="sm"
          variant="primary"
          onClick={() => void handleApply()}
          disabled={isFullFrame || isCropping}
        >
          {isCropping ? 'Cropping…' : 'Apply Crop'}
        </Button>
        {error && <p className="px-1 text-[11px] text-red-500">{error}</p>}
      </FloatingToolbar>
    </div>
  );
}
