import type { JSX } from 'react';
import { useEffect, useRef, useState } from 'react';
import type { Annotation, ImageAnnotation } from '@screen-recorder/types/project';
import { REFERENCE_CANVAS_WIDTH } from '@shared/constants';
import {
  useAnnotationsStore,
  TEXT_BACKGROUND_PADDING_X,
  TEXT_BACKGROUND_PADDING_Y,
  TEXT_BACKGROUND_RADIUS,
  DEFAULT_IMAGE_SIZE
} from '../store/annotations-store';
import { resolveTextAnimationPreset } from '../presets/text-animation-presets';
import { applySnapOffset, computeDragBBoxPx, snapAxis, type DragPatch } from '../lib/drag-snap';
import { RESIZE_HANDLES, handlePointPx, resizeImage } from '../lib/image-resize';
import { beginGesture, endGesture } from '../../history/store/history-store';
import { selectAnnotation } from '../../../app/selection-coordinator';
import { cn } from '../../../lib/utils';

interface AnnotationOverlayProps {
  currentTimeMs: number;
  /** Rendered on-screen width of the whole stage -- same reference frame cursor/webcam scale against, see REFERENCE_CANVAS_WIDTH. */
  stageWidthPx: number;
}

function isActive(atMs: number, annotation: Annotation): boolean {
  return (
    annotation.enabled && atMs >= annotation.atMs && atMs <= annotation.atMs + annotation.durationMs
  );
}

type DragMove = (dxRef: number, dyRef: number) => DragPatch;

interface DragState {
  id: string;
  startClientX: number;
  startClientY: number;
  onMove: DragMove;
  /** Text/image's rendered size at drag-start (font/content don't change mid-drag, so no need to re-measure every pointermove); `null` for arrows, which need no size to find their bbox. */
  measuredSizePx: { width: number; height: number } | null;
}

interface DragGuides {
  vLineXPx: number | null;
  hLineYPx: number | null;
}

const NO_GUIDES: DragGuides = { vLineXPx: null, hLineYPx: null };

interface ResizeState {
  id: string;
  startClientX: number;
  startClientY: number;
  handle: (typeof RESIZE_HANDLES)[number];
  base: { position: { x: number; y: number }; size: { width: number; height: number } };
  /** The image's natural width/height ratio, locked for the whole drag -- see `getNaturalAspectRatio`. */
  aspectRatio: number;
}

/**
 * Live editor approximation of what frame-compositor.ts's drawAnnotations
 * bakes into the export -- same position/scale convention (REFERENCE_CANVAS_
 * WIDTH units scaled against the stage, drawn untransformed so content zoom
 * doesn't affect them, same as the webcam PiP), rendered here as real DOM
 * nodes instead of canvas draws so they're directly draggable.
 */
export function AnnotationOverlay({
  currentTimeMs,
  stageWidthPx
}: AnnotationOverlayProps): JSX.Element {
  const annotations = useAnnotationsStore((s) => s.annotations);
  const selectedAnnotationId = useAnnotationsStore((s) => s.selectedAnnotationId);
  const updateAnnotation = useAnnotationsStore((s) => s.updateAnnotation);

  const scale = stageWidthPx > 0 ? stageWidthPx / REFERENCE_CANVAS_WIDTH : 1;
  const dragState = useRef<DragState | null>(null);
  const elRefs = useRef(new Map<string, HTMLElement>());
  const [guides, setGuides] = useState<DragGuides>(NO_GUIDES);
  const resizeState = useRef<ResizeState | null>(null);
  // Natural (unscaled) size of each image annotation's asset, read via
  // `onLoad` -- only used as a fallback while `annotation.size` is unset
  // (i.e. before the user has ever dragged a resize handle).
  const [naturalSizes, setNaturalSizes] = useState<
    Record<string, { width: number; height: number }>
  >({});

  const containerRef = useRef<HTMLDivElement>(null);
  const [stageHeightPx, setStageHeightPx] = useState(0);

  // Only height needs measuring locally -- width already arrives as
  // `stageWidthPx`, which every position/scale calculation here already
  // assumes matches this same box.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const blockSize = entries[0]?.borderBoxSize?.[0]?.blockSize;
      setStageHeightPx(blockSize ?? el.getBoundingClientRect().height);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  function handleDragMove(event: PointerEvent): void {
    const drag = dragState.current;
    if (!drag) return;
    const base = annotations.find((a) => a.id === drag.id);
    if (!base) return;

    const dxRef = (event.clientX - drag.startClientX) / scale;
    const dyRef = (event.clientY - drag.startClientY) / scale;
    const rawPatch = drag.onMove(dxRef, dyRef);

    const box = computeDragBBoxPx(base, rawPatch, scale, drag.measuredSizePx);
    const xSnap = stageWidthPx > 0 ? snapAxis(box.leftPx, box.rightPx, stageWidthPx) : null;
    const ySnap = stageHeightPx > 0 ? snapAxis(box.topPx, box.bottomPx, stageHeightPx) : null;

    updateAnnotation(
      drag.id,
      applySnapOffset(rawPatch, xSnap?.offsetPx ?? 0, ySnap?.offsetPx ?? 0, scale)
    );
    setGuides({ vLineXPx: xSnap?.linePx ?? null, hLineYPx: ySnap?.linePx ?? null });
  }

  function stopDrag(): void {
    if (dragState.current) endGesture();
    dragState.current = null;
    setGuides(NO_GUIDES);
    window.removeEventListener('pointermove', handleDragMove);
  }

  function startDrag(id: string, onMove: DragMove) {
    return (event: React.PointerEvent): void => {
      event.preventDefault();
      event.stopPropagation();
      selectAnnotation(id);
      beginGesture();
      const el = elRefs.current.get(id);
      const measuredSizePx = el
        ? { width: el.getBoundingClientRect().width, height: el.getBoundingClientRect().height }
        : null;
      dragState.current = {
        id,
        startClientX: event.clientX,
        startClientY: event.clientY,
        onMove,
        measuredSizePx
      };
      window.addEventListener('pointermove', handleDragMove);
      window.addEventListener('pointerup', stopDrag, { once: true });
    };
  }

  function registerEl(id: string) {
    return (el: HTMLElement | null): void => {
      if (el) elRefs.current.set(id, el);
      else elRefs.current.delete(id);
    };
  }

  function getImageSize(annotation: ImageAnnotation): { width: number; height: number } {
    return annotation.size ?? naturalSizes[annotation.id] ?? DEFAULT_IMAGE_SIZE;
  }

  // Always the asset's true natural size, regardless of any `size` override
  // already applied -- what resizing should stay proportional to, even if
  // the annotation was previously stretched non-uniformly.
  function getNaturalAspectRatio(annotation: ImageAnnotation): number {
    const natural = naturalSizes[annotation.id] ?? annotation.size ?? DEFAULT_IMAGE_SIZE;
    return natural.width / natural.height;
  }

  function handleResizeMove(event: PointerEvent): void {
    const drag = resizeState.current;
    if (!drag) return;
    const dxRef = (event.clientX - drag.startClientX) / scale;
    const dyRef = (event.clientY - drag.startClientY) / scale;
    const { position, size } = resizeImage(drag.base, drag.handle, dxRef, dyRef, drag.aspectRatio);
    updateAnnotation(drag.id, { position, size });
  }

  function stopResize(): void {
    if (resizeState.current) endGesture();
    resizeState.current = null;
    window.removeEventListener('pointermove', handleResizeMove);
  }

  function startResize(annotation: ImageAnnotation, handle: (typeof RESIZE_HANDLES)[number]) {
    return (event: React.PointerEvent): void => {
      event.preventDefault();
      event.stopPropagation();
      selectAnnotation(annotation.id);
      beginGesture();
      resizeState.current = {
        id: annotation.id,
        startClientX: event.clientX,
        startClientY: event.clientY,
        handle,
        base: { position: annotation.position, size: getImageSize(annotation) },
        aspectRatio: getNaturalAspectRatio(annotation)
      };
      window.addEventListener('pointermove', handleResizeMove);
      window.addEventListener('pointerup', stopResize, { once: true });
    };
  }

  // Guards against the pointerup listener never firing (this overlay
  // unmounts mid-drag) -- otherwise the gesture it opened would stay open
  // forever, silently swallowing every undo-tracked change made afterward.
  useEffect(() => {
    return () => {
      if (dragState.current) endGesture();
      if (resizeState.current) endGesture();
    };
  }, []);

  const active = annotations.filter((a) => isActive(currentTimeMs, a));

  return (
    <div ref={containerRef} className="pointer-events-none absolute inset-0 z-10">
      {active.map((annotation) => {
        const isSelected = selectedAnnotationId === annotation.id;

        if (annotation.kind === 'text') {
          const preset = resolveTextAnimationPreset(annotation.animationPreset);
          const speed = annotation.animationSpeed > 0 ? annotation.animationSpeed : 1;
          const durationMs = preset.durationMs / speed;
          const elapsedMs = currentTimeMs - annotation.atMs;
          const remainingMs = annotation.atMs + annotation.durationMs - currentTimeMs;
          const withinEntrance = elapsedMs <= durationMs;
          // Typewriter gets a reverse "clearing" pass near the end of its
          // active window instead of just vanishing -- only once typing-in
          // has actually finished, so a short total duration can't flip
          // straight into clearing before anything typed (see
          // resolveTextEntrance's matching guard for the export renderer).
          const isClearing =
            preset.id === 'typewriter' && elapsedMs >= durationMs && remainingMs <= durationMs;
          const animationClassName = isClearing
            ? 'animate-annotation-typewriter-exit'
            : withinEntrance
              ? preset.className
              : null;
          return (
            <div
              key={annotation.id}
              ref={registerEl(annotation.id)}
              onPointerDown={startDrag(annotation.id, (dx, dy) => ({
                position: { x: annotation.position.x + dx, y: annotation.position.y + dy }
              }))}
              className={cn(
                'pointer-events-auto absolute -translate-y-full cursor-grab whitespace-nowrap font-sans font-medium active:cursor-grabbing',
                isSelected && 'rounded outline outline-2 outline-offset-4 outline-accent',
                animationClassName
              )}
              style={{
                left: annotation.position.x * scale,
                top: annotation.position.y * scale,
                fontSize: annotation.fontSize * scale,
                color: annotation.color,
                textShadow: '0 1px 3px rgba(0,0,0,0.6)',
                // The Tailwind `--animate-*` class bakes in each preset's
                // *default* (1x) duration -- overridden here so `animationSpeed`
                // actually speeds up/slows down the CSS animation itself.
                ...(animationClassName && { animationDuration: `${durationMs}ms` }),
                // Typewriter's CSS class defaults to a fixed step count --
                // overridden to one step per character so the reveal (and the
                // background pill growing along with it) advances smoothly
                // instead of jumping in a handful of uneven chunks.
                ...(preset.id === 'typewriter' && {
                  animationTimingFunction: `steps(${Math.max(1, annotation.text.length)}, end)`
                }),
                ...(annotation.backgroundColor && {
                  backgroundColor: annotation.backgroundColor,
                  padding: `${TEXT_BACKGROUND_PADDING_Y * scale}px ${TEXT_BACKGROUND_PADDING_X * scale}px`,
                  borderRadius: TEXT_BACKGROUND_RADIUS * scale
                })
              }}
            >
              {annotation.text}
            </div>
          );
        }

        if (annotation.kind === 'arrow') {
          const x1 = annotation.position.x * scale;
          const y1 = annotation.position.y * scale;
          const x2 = annotation.to.x * scale;
          const y2 = annotation.to.y * scale;
          const angle = Math.atan2(y2 - y1, x2 - x1);
          const headLength = 14 * scale;
          const hx1 = x2 - headLength * Math.cos(angle - Math.PI / 6);
          const hy1 = y2 - headLength * Math.sin(angle - Math.PI / 6);
          const hx2 = x2 - headLength * Math.cos(angle + Math.PI / 6);
          const hy2 = y2 - headLength * Math.sin(angle + Math.PI / 6);
          const strokeWidth = Math.max(2, annotation.thickness * scale);
          // Dashing only applies to the shaft -- matches drawArrow's export
          // behavior, so the head always reads as a clean arrowhead.
          const dashArray =
            annotation.style === 'dashed' ? `${strokeWidth * 2.5} ${strokeWidth * 1.8}` : undefined;
          return (
            <svg
              key={annotation.id}
              className="pointer-events-none absolute inset-0 overflow-visible"
            >
              {isSelected && (
                <line
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke="var(--color-accent)"
                  strokeOpacity={0.5}
                  strokeWidth={strokeWidth + 5}
                  strokeLinecap="round"
                />
              )}
              <g>
                <line
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={annotation.color}
                  strokeWidth={strokeWidth}
                  strokeDasharray={dashArray}
                />
                <line
                  x1={x2}
                  y1={y2}
                  x2={hx1}
                  y2={hy1}
                  stroke={annotation.color}
                  strokeWidth={strokeWidth}
                />
                <line
                  x1={x2}
                  y1={y2}
                  x2={hx2}
                  y2={hy2}
                  stroke={annotation.color}
                  strokeWidth={strokeWidth}
                />
              </g>
              <circle
                onPointerDown={startDrag(annotation.id, (dx, dy) => ({
                  position: { x: annotation.position.x + dx, y: annotation.position.y + dy },
                  to: { x: annotation.to.x + dx, y: annotation.to.y + dy }
                }))}
                cx={x1}
                cy={y1}
                r={7}
                className={cn(
                  'pointer-events-auto cursor-grab fill-white/20 stroke-white active:cursor-grabbing',
                  isSelected && 'fill-accent/30 stroke-accent'
                )}
                strokeWidth={1.5}
              />
              <circle
                onPointerDown={startDrag(annotation.id, (dx, dy) => ({
                  to: { x: annotation.to.x + dx, y: annotation.to.y + dy }
                }))}
                cx={x2}
                cy={y2}
                r={7}
                className={cn(
                  'pointer-events-auto cursor-grab fill-white/20 stroke-white active:cursor-grabbing',
                  isSelected && 'fill-accent/30 stroke-accent'
                )}
                strokeWidth={1.5}
              />
            </svg>
          );
        }

        const imageSize = getImageSize(annotation);
        const imageBoxPx = {
          leftPx: annotation.position.x * scale,
          topPx: annotation.position.y * scale,
          widthPx: imageSize.width * scale,
          heightPx: imageSize.height * scale
        };
        return (
          <div key={annotation.id}>
            <img
              ref={registerEl(annotation.id)}
              src={annotation.assetPath}
              alt=""
              onLoad={(event) => {
                const img = event.currentTarget;
                setNaturalSizes((prev) => ({
                  ...prev,
                  [annotation.id]: { width: img.naturalWidth, height: img.naturalHeight }
                }));
              }}
              onPointerDown={startDrag(annotation.id, (dx, dy) => ({
                position: { x: annotation.position.x + dx, y: annotation.position.y + dy }
              }))}
              className={cn(
                'pointer-events-auto absolute cursor-grab active:cursor-grabbing',
                isSelected && 'outline outline-2 outline-offset-2 outline-accent'
              )}
              style={{
                left: imageBoxPx.leftPx,
                top: imageBoxPx.topPx,
                width: imageBoxPx.widthPx,
                height: imageBoxPx.heightPx
              }}
            />
            {isSelected &&
              RESIZE_HANDLES.map((handle) => {
                const point = handlePointPx(handle, imageBoxPx);
                return (
                  <div
                    key={handle.id}
                    onPointerDown={startResize(annotation, handle)}
                    className="pointer-events-auto absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-xs border border-accent bg-white"
                    style={{ left: point.x, top: point.y, cursor: handle.cursor }}
                  />
                );
              })}
          </div>
        );
      })}

      {guides.vLineXPx !== null && (
        <div
          className="pointer-events-none absolute top-0 bottom-0 w-px bg-accent"
          style={{ left: guides.vLineXPx }}
        />
      )}
      {guides.hLineYPx !== null && (
        <div
          className="pointer-events-none absolute left-0 right-0 h-px bg-accent"
          style={{ top: guides.hLineYPx }}
        />
      )}
    </div>
  );
}
