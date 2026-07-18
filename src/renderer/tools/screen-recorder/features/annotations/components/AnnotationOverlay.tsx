import type { JSX } from 'react';
import { useEffect, useRef } from 'react';
import type { Annotation } from '@screen-recorder/types/project';
import { REFERENCE_CANVAS_WIDTH } from '@shared/constants';
import { useAnnotationsStore } from '../store/annotations-store';
import { resolveTextAnimationPreset } from '../presets/text-animation-presets';
import { beginGesture, endGesture } from '../../history/store/history-store';
import { cn } from '../../../lib/utils';

interface AnnotationOverlayProps {
  currentTimeMs: number;
  /** Rendered on-screen width of the whole stage -- same reference frame cursor/webcam scale against, see REFERENCE_CANVAS_WIDTH. */
  stageWidthPx: number;
}

function isActive(atMs: number, annotation: Annotation): boolean {
  return atMs >= annotation.atMs && atMs <= annotation.atMs + annotation.durationMs;
}

/** How long into an annotation's active window the entrance animation plays. */
const ENTRANCE_WINDOW_MS = 450;

type DragMove = (dxRef: number, dyRef: number) => void;

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
  const setSelectedAnnotationId = useAnnotationsStore((s) => s.setSelectedAnnotationId);
  const updateAnnotation = useAnnotationsStore((s) => s.updateAnnotation);

  const scale = stageWidthPx > 0 ? stageWidthPx / REFERENCE_CANVAS_WIDTH : 1;
  const dragState = useRef<{ startClientX: number; startClientY: number; onMove: DragMove } | null>(
    null
  );

  function handleDragMove(event: PointerEvent): void {
    const drag = dragState.current;
    if (!drag) return;
    const dxRef = (event.clientX - drag.startClientX) / scale;
    const dyRef = (event.clientY - drag.startClientY) / scale;
    drag.onMove(dxRef, dyRef);
  }

  function stopDrag(): void {
    if (dragState.current) endGesture();
    dragState.current = null;
    window.removeEventListener('pointermove', handleDragMove);
  }

  function startDrag(id: string, onMove: DragMove) {
    return (event: React.PointerEvent): void => {
      event.preventDefault();
      event.stopPropagation();
      setSelectedAnnotationId(id);
      beginGesture();
      dragState.current = { startClientX: event.clientX, startClientY: event.clientY, onMove };
      window.addEventListener('pointermove', handleDragMove);
      window.addEventListener('pointerup', stopDrag, { once: true });
    };
  }

  // Guards against the pointerup listener never firing (this overlay
  // unmounts mid-drag) -- otherwise the gesture it opened would stay open
  // forever, silently swallowing every undo-tracked change made afterward.
  useEffect(() => {
    return () => {
      if (dragState.current) endGesture();
    };
  }, []);

  const active = annotations.filter((a) => isActive(currentTimeMs, a));

  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      {active.map((annotation) => {
        const isSelected = selectedAnnotationId === annotation.id;
        const withinEntrance = currentTimeMs - annotation.atMs <= ENTRANCE_WINDOW_MS;

        if (annotation.kind === 'text') {
          const preset = withinEntrance
            ? resolveTextAnimationPreset(annotation.animationPreset)
            : null;
          return (
            <div
              key={annotation.id}
              onPointerDown={startDrag(annotation.id, (dx, dy) =>
                updateAnnotation(annotation.id, {
                  position: { x: annotation.position.x + dx, y: annotation.position.y + dy }
                })
              )}
              className={cn(
                'pointer-events-auto absolute -translate-y-full cursor-grab whitespace-nowrap font-sans font-medium text-white active:cursor-grabbing',
                isSelected && 'rounded outline outline-2 outline-offset-4 outline-accent',
                preset?.className
              )}
              style={{
                left: annotation.position.x * scale,
                top: annotation.position.y * scale,
                fontSize: 28 * scale,
                textShadow: '0 1px 3px rgba(0,0,0,0.6)'
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
                onPointerDown={startDrag(annotation.id, (dx, dy) =>
                  updateAnnotation(annotation.id, {
                    position: { x: annotation.position.x + dx, y: annotation.position.y + dy },
                    to: { x: annotation.to.x + dx, y: annotation.to.y + dy }
                  })
                )}
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
                onPointerDown={startDrag(annotation.id, (dx, dy) =>
                  updateAnnotation(annotation.id, {
                    to: { x: annotation.to.x + dx, y: annotation.to.y + dy }
                  })
                )}
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

        return (
          <img
            key={annotation.id}
            src={annotation.assetPath}
            alt=""
            onPointerDown={startDrag(annotation.id, (dx, dy) =>
              updateAnnotation(annotation.id, {
                position: { x: annotation.position.x + dx, y: annotation.position.y + dy }
              })
            )}
            className={cn(
              'pointer-events-auto absolute cursor-grab origin-top-left active:cursor-grabbing',
              isSelected && 'outline outline-2 outline-offset-2 outline-accent'
            )}
            style={{
              left: annotation.position.x * scale,
              top: annotation.position.y * scale,
              transform: `scale(${scale})`
            }}
          />
        );
      })}
    </div>
  );
}
