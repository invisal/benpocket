import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import cn from 'cnfast';

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 8;

/** Auto-fit leaves this fraction of the container as breathing room around the image, rather than
 * touching the edges. */
const FIT_PADDING = 0.7;

const MOUSE_LEFT = 0;
const MOUSE_MIDDLE = 1;
const MOUSE_RIGHT = 2;

/** Content is centered by the flex wrapper before `pan` is applied, so panning by more than half
 * the overflow in either direction would pull the content's far edge past the container, leaving a
 * gap. `size` is the size (in one axis) of the already-zoomed content; `containerSize` is the
 * container's. Returns 0 when the content fits (nothing to pan). */
function maxPanForAxis(size: number, containerSize: number): number {
  return Math.max(0, (size - containerSize) / 2);
}

function clampAxis(value: number, max: number): number {
  return Math.min(max, Math.max(-max, value));
}

interface ImageCanvasProps {
  imageData: ImageData;
  /** `null` = auto-fit to the container, recomputed whenever the container resizes (like Windows
   * Photos' default view). A number = manual zoom, an absolute multiple of native pixel size (1 =
   * 100%) that stays fixed across container resizes. */
  zoom: number | null;
  onZoomChange: (zoom: number | null) => void;
  /** The zoom actually on screen right now: the auto-fit scale while `zoom` is `null`, or `zoom`
   * itself otherwise. Reported back up since only this component knows the fit scale (it depends
   * on the container's measured size). */
  onEffectiveZoomChange?: (effectiveZoom: number) => void;
  /** Offset in unscaled screen pixels, independent of zoom -- panning speed stays 1:1 with the
   * mouse regardless of zoom level. */
  pan: { x: number; y: number };
  onPanChange: (pan: { x: number; y: number }) => void;
  /** Middle and right mouse buttons always pan. Left is reserved for a tool's own left-click
   * interaction (Crop's drag handles, the mask brush) -- set this when there isn't one (Preview) so
   * left click pans too, which is the more natural default when there's nothing else to click. */
  leftClickPans?: boolean;
  /** Overlay content (crop handles, mask brush canvas) positioned to exactly cover the rendered canvas. */
  children?: ReactNode;
  className?: string;
}

/**
 * Renders `imageData` at a size driven by two independently-tracked zoom values, the same way
 * Windows Photos does: a "fit scale" continuously recomputed from a `ResizeObserver` on the
 * container (so it stays correct across container resizes, like `object-contain`), and `zoom`, an
 * absolute manual override the caller owns -- `null` while nobody has manually zoomed (fit scale
 * drives the display and keeps auto-updating on resize), a concrete number once they have (that
 * value drives the display instead, unaffected by further container resizes, until they zoom
 * again). The fit scale is computed here (not left to CSS `max-width/height: 100%`) because that
 * only resolves reliably when every ancestor has a *definite* size to resolve the percentage
 * against; the canvas's wrapper is sized to its own content, so for some images -- reliably
 * reproducible with very large ones -- the percentage has nothing definite to resolve against and
 * the browser doesn't contain it. `pan` is applied via a `translate` on top of that sizing; the
 * wrapper stays sized to exactly the current on-screen content size so overlays (crop handles, mask
 * brush) positioned with `absolute inset-0` stay pixel-aligned regardless of pan/zoom.
 * `overflow-hidden` on the outer container clips a panned/zoomed-in image to this tool's own canvas
 * area -- it never bleeds into a sibling toolbar. Each tool mounts its own instance of this rather
 * than sharing one.
 */
export function ImageCanvas({
  imageData,
  zoom,
  onZoomChange,
  onEffectiveZoomChange,
  pan,
  onPanChange,
  leftClickPans = false,
  children,
  className
}: ImageCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const panRef = useRef(pan);
  const onZoomChangeRef = useRef(onZoomChange);
  const onPanChangeRef = useRef(onPanChange);
  const leftClickPansRef = useRef(leftClickPans);
  const [isPanning, setIsPanning] = useState(false);
  const [containerSize, setContainerSize] = useState<{ width: number; height: number } | null>(
    null
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    const ctx = canvas.getContext('2d');
    ctx?.putImageData(imageData, 0, 0);
  }, [imageData]);

  // `useLayoutEffect`, and a synchronous seed measurement before `observe()`, so `containerSize` is
  // already correct on the very first paint -- a `ResizeObserver`'s own callback only fires after
  // that first paint, which for a large image means one frame flashed at native (fitScale-fallback)
  // size before snapping down, a visible flicker `useEffect` alone doesn't avoid.
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    setContainerSize({ width: container.clientWidth, height: container.clientHeight });

    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const box = entry.contentBoxSize?.[0];
      setContainerSize(
        box
          ? { width: box.inlineSize, height: box.blockSize }
          : { width: entry.contentRect.width, height: entry.contentRect.height }
      );
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // The largest scale, at or below 1 (native resolution), that fits `imageData` within
  // `FIT_PADDING` of the container -- whichever axis is more constraining wins, same as
  // `object-contain`. Falls back to native size only until the layout effect above has run.
  const fitScale = containerSize
    ? Math.min(
        1,
        (containerSize.width * FIT_PADDING) / imageData.width,
        (containerSize.height * FIT_PADDING) / imageData.height
      )
    : 1;
  const effectiveZoom = zoom ?? fitScale;
  const contentWidth = imageData.width * effectiveZoom;
  const contentHeight = imageData.height * effectiveZoom;
  const effectiveZoomRef = useRef(effectiveZoom);

  useEffect(() => {
    panRef.current = pan;
  }, [pan]);

  useEffect(() => {
    onZoomChangeRef.current = onZoomChange;
  }, [onZoomChange]);

  useEffect(() => {
    onPanChangeRef.current = onPanChange;
  }, [onPanChange]);

  useEffect(() => {
    leftClickPansRef.current = leftClickPans;
  }, [leftClickPans]);

  useEffect(() => {
    effectiveZoomRef.current = effectiveZoom;
    onEffectiveZoomChange?.(effectiveZoom);
  }, [effectiveZoom, onEffectiveZoomChange]);

  // Re-clamps a stale pan offset after the on-screen size changes -- e.g. zooming back out after
  // having panned while zoomed in, or the fit scale shrinking because the container got smaller --
  // so the content's edge can't end up sitting short of the container's, leaving a gap.
  useEffect(() => {
    const container = containerRef.current;
    const content = contentRef.current;
    if (!container || !content) return;
    const containerRect = container.getBoundingClientRect();
    const contentRect = content.getBoundingClientRect();
    const current = panRef.current;
    const next = {
      x: clampAxis(current.x, maxPanForAxis(contentRect.width, containerRect.width)),
      y: clampAxis(current.y, maxPanForAxis(contentRect.height, containerRect.height))
    };
    if (next.x !== current.x || next.y !== current.y) onPanChangeRef.current(next);
  }, [effectiveZoom]);

  // Plain DOM listeners (not React's onWheel/onPointerDown) so `preventDefault` on wheel actually
  // works -- React attaches wheel listeners as passive -- and so the pan-button check here runs
  // regardless of what a tool's own overlay (Crop's handles, the mask brush) does with left clicks;
  // neither of those call stopPropagation for buttons other than the left one when `leftClickPans`
  // is off, so this bubble-phase listener still sees every pan-eligible press that lands on the canvas.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    function handleWheel(event: WheelEvent): void {
      event.preventDefault();
      const factor = Math.exp(-event.deltaY * 0.002);
      // Always starts from whatever is currently on screen (fit or manual), so the first scroll
      // never jumps -- and always produces a concrete number, which is what hands the caller off
      // from auto-fit into manual zoom, exactly like scrolling in Windows Photos does.
      const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, effectiveZoomRef.current * factor));
      onZoomChangeRef.current(next);
    }

    function handlePointerDown(event: PointerEvent): void {
      const isPanButton =
        event.button === MOUSE_MIDDLE ||
        event.button === MOUSE_RIGHT ||
        (event.button === MOUSE_LEFT && leftClickPansRef.current);
      if (!isPanButton) return;

      // The draggable range on each axis is bounded by how far the (already zoomed) content
      // overflows the container -- an axis that fully fits has a range of 0, so it never moves;
      // an axis that overflows can move up to half the overflow before its far edge would clear
      // the container and leave a gap.
      const containerEl = containerRef.current;
      const content = contentRef.current;
      if (!containerEl || !content) return;
      const containerRect = containerEl.getBoundingClientRect();
      const contentRect = content.getBoundingClientRect();
      const maxPanX = maxPanForAxis(contentRect.width, containerRect.width);
      const maxPanY = maxPanForAxis(contentRect.height, containerRect.height);
      if (maxPanX === 0 && maxPanY === 0) return;

      // Suppress the browser's own middle-click autoscroll and the right-click context menu --
      // both would otherwise fire alongside our own pan.
      event.preventDefault();
      const startClientX = event.clientX;
      const startClientY = event.clientY;
      const startPan = panRef.current;
      setIsPanning(true);

      function handlePointerMove(moveEvent: globalThis.PointerEvent): void {
        onPanChangeRef.current({
          x: clampAxis(startPan.x + (moveEvent.clientX - startClientX), maxPanX),
          y: clampAxis(startPan.y + (moveEvent.clientY - startClientY), maxPanY)
        });
      }
      function stopPanning(): void {
        setIsPanning(false);
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', stopPanning);
      }

      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', stopPanning, { once: true });
    }

    function handleContextMenu(event: MouseEvent): void {
      event.preventDefault();
    }

    container.addEventListener('wheel', handleWheel, { passive: false });
    container.addEventListener('pointerdown', handlePointerDown);
    container.addEventListener('contextmenu', handleContextMenu);
    return () => {
      container.removeEventListener('wheel', handleWheel);
      container.removeEventListener('pointerdown', handlePointerDown);
      container.removeEventListener('contextmenu', handleContextMenu);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={cn(
        'flex flex-1 items-center justify-center overflow-hidden bg-dotted p-3',
        isPanning ? 'cursor-grabbing' : leftClickPans && 'cursor-grab',
        className
      )}
    >
      <div
        ref={contentRef}
        className="relative"
        style={{
          width: contentWidth,
          height: contentHeight,
          transform: `translate(${pan.x}px, ${pan.y}px)`
        }}
      >
        <canvas
          ref={canvasRef}
          className="block"
          style={{ width: contentWidth, height: contentHeight }}
        />
        {children}
      </div>
    </div>
  );
}
