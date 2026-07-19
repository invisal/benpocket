import type { JSX } from 'react';
import { useEffect, useRef, useState } from 'react';
import { cn } from 'cnfast';
import { nextLabelValue, useCaptureEditorStore } from '../store/editor.store';
import {
  BLUR_RADIUS_UNITS,
  arrowHeadLength,
  arrowHeadPoints,
  labelTextColor,
  normalizeRect
} from '../lib/flatten';
import type {
  BlurAnnotation,
  CaptureAnnotation,
  RectAnnotation,
  TextAnnotation
} from '../types/editor';

interface CaptureEditorProps {
  dataUrl: string;
}

type Corner = 'nw' | 'ne' | 'sw' | 'se';
const CORNERS: Corner[] = ['nw', 'ne', 'sw', 'se'];

const CORNER_CLASSES: Record<Corner, string> = {
  nw: 'left-0 top-0 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize',
  ne: 'right-0 top-0 translate-x-1/2 -translate-y-1/2 cursor-nesw-resize',
  sw: 'bottom-0 left-0 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize',
  se: 'bottom-0 right-0 translate-x-1/2 translate-y-1/2 cursor-nwse-resize'
};

/** Ignore creation drags smaller than this (in image px) — treat as a stray click. */
const MIN_DRAG_PX = 4;

interface Draft {
  kind: 'rect' | 'blur' | 'arrow';
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

type DragMove = (dxImg: number, dyImg: number) => void;

/**
 * Inline editor for a text annotation. Keystrokes stream into the store live
 * (untracked, so the clipboard auto-copy sees text without waiting for a
 * commit); Enter/blur/Escape finalize exactly once. No commit-on-unmount:
 * StrictMode's simulated effect cleanup would run it with an empty value
 * right after mount and delete the annotation. Instead, every path that
 * unmounts this input without a native blur (placing a second text mid-edit)
 * explicitly blurs the active element first — see handleStagePointerDown's
 * text branch.
 *
 * Undo bookkeeping: a freshly-placed annotation (initial text '') is covered
 * by addAnnotation's entry, so the whole type-and-commit session is one undo
 * step. A re-edit session opens a gesture at mount and closes it on commit,
 * so it's also one step.
 */
function TextEditInput({
  annotation,
  scale
}: {
  annotation: TextAnnotation;
  scale: number;
}): JSX.Element {
  const committed = useRef(false);
  // Captured on first render (state initializer never re-runs); the
  // annotation prop changes as typing streams into the store, but the
  // pre-edit text must stay fixed for Escape/undo.
  const [initialText] = useState(annotation.text);

  useEffect(() => {
    if (initialText) useCaptureEditorStore.getState().beginGesture();
  }, [initialText]);

  function finish(action: 'commit' | 'cancel', value: string): void {
    if (committed.current) return;
    committed.current = true;
    const s = useCaptureEditorStore.getState();
    const isReEdit = initialText !== '';
    const text = action === 'cancel' ? initialText : value.trim();
    if (text) {
      s.moveAnnotation(annotation.id, { text });
      // Closing the gesture records the re-edit as one undo entry; skipped
      // when nothing changed or on cancel (state is back to the original).
      if (isReEdit && action === 'commit' && text !== initialText) s.endGesture();
    } else {
      s.discardAnnotation(annotation.id);
      // Clearing an existing text and committing is a deletion — undoable.
      if (isReEdit && action === 'commit') s.endGesture();
    }
    if (s.editingId === annotation.id) s.setEditingId(null);
  }

  return (
    <input
      autoFocus
      defaultValue={initialText}
      placeholder="Text…"
      onChange={(e) =>
        useCaptureEditorStore.getState().moveAnnotation(annotation.id, { text: e.target.value })
      }
      onBlur={(e) => finish('commit', e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') finish('commit', e.currentTarget.value);
        if (e.key === 'Escape') finish('cancel', '');
      }}
      onPointerDown={(e) => e.stopPropagation()}
      className="pointer-events-auto absolute min-w-24 border border-dashed border-accent bg-transparent font-medium outline-none placeholder:text-white/40"
      style={{
        left: annotation.x * scale,
        top: annotation.y * scale,
        color: annotation.color,
        fontSize: annotation.fontSize * scale,
        textShadow: '0 1px 3px rgba(0,0,0,0.6)'
      }}
    />
  );
}

/**
 * Annotation editor stage: the screenshot with SVG (arrows) and DOM
 * (rect/text/label/blur) overlay layers. Same live-editing conventions as
 * screen-recorder's AnnotationOverlay/BlurMaskOverlay, minus the time
 * dimension: geometry lives in image pixel space and is multiplied by
 * `scale` (displayed px per image px) for rendering, so flatten.ts can draw
 * the exact same numbers 1:1 at export.
 */
export function CaptureEditor({ dataUrl }: CaptureEditorProps): JSX.Element {
  const store = useCaptureEditorStore;
  const annotations = useCaptureEditorStore((s) => s.annotations);
  const imageWidth = useCaptureEditorStore((s) => s.imageWidth);
  const imageHeight = useCaptureEditorStore((s) => s.imageHeight);
  const unit = useCaptureEditorStore((s) => s.unit);
  const tool = useCaptureEditorStore((s) => s.tool);
  const selectedId = useCaptureEditorStore((s) => s.selectedId);
  const editingId = useCaptureEditorStore((s) => s.editingId);
  const cornerRadius = useCaptureEditorStore((s) => s.cornerRadius);

  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [draft, setDraft] = useState<Draft | null>(null);
  const activeDrag = useRef<{ move: (e: PointerEvent) => void; up: () => void } | null>(null);

  // Fit the stage inside the container preserving aspect ratio, never
  // upscaling past native resolution (matches the old object-contain img).
  const fitScale =
    imageWidth > 0 && containerSize.width > 0
      ? Math.min(containerSize.width / imageWidth, containerSize.height / imageHeight, 1)
      : 0;
  const stageWidth = imageWidth * fitScale;
  const stageHeight = imageHeight * fitScale;
  const scale = fitScale > 0 ? fitScale : 1;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() =>
      setContainerSize({ width: container.clientWidth, height: container.clientHeight })
    );
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Delete/Escape/undo/redo shortcuts. Skipped while the inline text input
  // has focus so Backspace edits text instead of deleting the annotation.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
      const s = store.getState();
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) s.redo();
        else s.undo();
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') {
        event.preventDefault();
        s.redo();
      } else if ((event.key === 'Delete' || event.key === 'Backspace') && s.selectedId) {
        s.removeAnnotation(s.selectedId);
      } else if (event.key === 'Escape') {
        s.setSelectedId(null);
        s.setEditingId(null);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [store]);

  // Guards against the pointerup listener never firing (editor unmounts
  // mid-drag) -- otherwise the window pointermove listener and the open
  // undo gesture would both leak.
  useEffect(() => {
    return () => {
      const drag = activeDrag.current;
      if (!drag) return;
      window.removeEventListener('pointermove', drag.move);
      window.removeEventListener('pointerup', drag.up);
      store.getState().endGesture();
    };
  }, [store]);

  function toImagePoint(event: { clientX: number; clientY: number }): { x: number; y: number } {
    const bounds = stageRef.current?.getBoundingClientRect();
    if (!bounds) return { x: 0, y: 0 };
    return { x: (event.clientX - bounds.left) / scale, y: (event.clientY - bounds.top) / scale };
  }

  function startDrag(id: string, onMove: DragMove) {
    return (event: React.PointerEvent): void => {
      if (tool !== 'select' || event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      const s = store.getState();
      s.setSelectedId(id);
      s.beginGesture();
      const startClientX = event.clientX;
      const startClientY = event.clientY;
      const move = (e: PointerEvent): void =>
        onMove((e.clientX - startClientX) / scale, (e.clientY - startClientY) / scale);
      const up = (): void => {
        window.removeEventListener('pointermove', move);
        activeDrag.current = null;
        store.getState().endGesture();
      };
      activeDrag.current = { move, up };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up, { once: true });
    };
  }

  function cornerDragMove(annotation: RectAnnotation | BlurAnnotation, corner: Corner): DragMove {
    const start = {
      x: annotation.x,
      y: annotation.y,
      width: annotation.width,
      height: annotation.height
    };
    const minSize = MIN_DRAG_PX * 2;
    return (dx, dy) => {
      const movesLeft = corner === 'nw' || corner === 'sw';
      const movesTop = corner === 'nw' || corner === 'ne';
      const width = Math.max(minSize, movesLeft ? start.width - dx : start.width + dx);
      const height = Math.max(minSize, movesTop ? start.height - dy : start.height + dy);
      store.getState().moveAnnotation(annotation.id, {
        x: movesLeft ? start.x + start.width - width : start.x,
        y: movesTop ? start.y + start.height - height : start.y,
        width,
        height
      });
    };
  }

  function handleStagePointerDown(event: React.PointerEvent): void {
    if (event.button !== 0) return;
    const s = store.getState();
    const point = toImagePoint(event);

    if (tool === 'select') {
      s.setSelectedId(null);
      s.setEditingId(null);
      return;
    }

    if (tool === 'text') {
      // Without this, the click's compatibility mousedown fires after the
      // input mounts and autofocuses, its default action steals focus back,
      // and the empty-text blur commit deletes the annotation instantly.
      event.preventDefault();
      // preventDefault also suppresses the native blur of an already-open
      // text input, so commit it explicitly: this click closes the current
      // edit, the next click places a new text.
      if (s.editingId) {
        (document.activeElement as HTMLElement | null)?.blur();
        return;
      }
      const id = crypto.randomUUID();
      s.addAnnotation({
        id,
        kind: 'text',
        x: point.x,
        y: point.y,
        text: '',
        color: s.color,
        fontSize: s.fontTier * unit
      });
      s.setEditingId(id);
      return;
    }

    if (tool === 'label') {
      s.addAnnotation({
        id: crypto.randomUUID(),
        kind: 'label',
        x: point.x,
        y: point.y,
        value: nextLabelValue(s.annotations),
        radius: 14 * unit,
        color: s.color
      });
      return;
    }

    // rect / arrow / blur: drag-to-create via a local draft, committed to the
    // store (one undo entry) only if the drag is big enough to be intentional.
    event.preventDefault();
    const start: Draft = {
      kind: tool,
      startX: point.x,
      startY: point.y,
      endX: point.x,
      endY: point.y
    };
    setDraft(start);

    const onMove = (moveEvent: PointerEvent): void => {
      const p = toImagePoint(moveEvent);
      setDraft({ ...start, endX: p.x, endY: p.y });
    };
    const onUp = (upEvent: PointerEvent): void => {
      window.removeEventListener('pointermove', onMove);
      setDraft(null);
      const end = toImagePoint(upEvent);
      commitDraft({ ...start, endX: end.x, endY: end.y });
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp, { once: true });
  }

  function commitDraft(d: Draft): void {
    const s = store.getState();
    if (Math.abs(d.endX - d.startX) < MIN_DRAG_PX && Math.abs(d.endY - d.startY) < MIN_DRAG_PX) {
      return;
    }

    if (d.kind === 'arrow') {
      s.addAnnotation({
        id: crypto.randomUUID(),
        kind: 'arrow',
        x1: d.startX,
        y1: d.startY,
        x2: d.endX,
        y2: d.endY,
        color: s.color,
        strokeWidth: s.strokeTier * unit
      });
      return;
    }
    const rect = normalizeRect(d.startX, d.startY, d.endX, d.endY);
    if (d.kind === 'rect') {
      s.addAnnotation({
        id: crypto.randomUUID(),
        kind: 'rect',
        ...rect,
        color: s.color,
        strokeWidth: s.strokeTier * unit
      });
    } else {
      s.addAnnotation({ id: crypto.randomUUID(), kind: 'blur', ...rect });
    }
  }

  const interactive = tool === 'select';

  function renderAnnotation(annotation: CaptureAnnotation): JSX.Element {
    const isSelected = selectedId === annotation.id;

    if (annotation.kind === 'blur' || annotation.kind === 'rect') {
      const isBlur = annotation.kind === 'blur';
      return (
        <div
          key={annotation.id}
          onPointerDown={startDrag(annotation.id, (dx, dy) =>
            store.getState().moveAnnotation(annotation.id, {
              x: annotation.x + dx,
              y: annotation.y + dy
            })
          )}
          className={cn(
            'absolute',
            interactive ? 'pointer-events-auto cursor-move' : 'pointer-events-none',
            isSelected && 'z-10'
          )}
          style={{
            left: annotation.x * scale,
            top: annotation.y * scale,
            width: annotation.width * scale,
            height: annotation.height * scale,
            ...(isBlur
              ? {
                  backdropFilter: `blur(${BLUR_RADIUS_UNITS * unit * scale}px)`,
                  WebkitBackdropFilter: `blur(${BLUR_RADIUS_UNITS * unit * scale}px)`
                }
              : {
                  border: `${Math.max(1, annotation.strokeWidth * scale)}px solid ${annotation.color}`
                })
          }}
        >
          {isSelected && (
            <>
              <div className="pointer-events-none absolute -inset-px border border-dashed border-accent" />
              {CORNERS.map((corner) => (
                <div
                  key={corner}
                  onPointerDown={startDrag(annotation.id, cornerDragMove(annotation, corner))}
                  className={cn(
                    'absolute h-3 w-3 rounded-full border-2 border-accent bg-surface',
                    CORNER_CLASSES[corner]
                  )}
                />
              ))}
            </>
          )}
        </div>
      );
    }

    if (annotation.kind === 'arrow') {
      const x1 = annotation.x1 * scale;
      const y1 = annotation.y1 * scale;
      const x2 = annotation.x2 * scale;
      const y2 = annotation.y2 * scale;
      const strokeWidth = Math.max(1.5, annotation.strokeWidth * scale);
      const head = arrowHeadPoints(x1, y1, x2, y2, arrowHeadLength(annotation.strokeWidth) * scale);
      const endpoints = [
        { keyX: 'x1', keyY: 'y1', cx: x1, cy: y1 },
        { keyX: 'x2', keyY: 'y2', cx: x2, cy: y2 }
      ] as const;
      return (
        <svg
          key={annotation.id}
          className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
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
          <path
            d={`M ${x1} ${y1} L ${x2} ${y2} M ${head.hx1} ${head.hy1} L ${x2} ${y2} L ${head.hx2} ${head.hy2}`}
            fill="none"
            stroke={annotation.color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
          {/* Invisible fat hit line so the whole arrow is grabbable, not just endpoints. */}
          <line
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="transparent"
            strokeWidth={Math.max(12, strokeWidth)}
            className={cn(interactive && 'pointer-events-auto cursor-move')}
            onPointerDown={startDrag(annotation.id, (dx, dy) =>
              store.getState().moveAnnotation(annotation.id, {
                x1: annotation.x1 + dx,
                y1: annotation.y1 + dy,
                x2: annotation.x2 + dx,
                y2: annotation.y2 + dy
              })
            )}
          />
          {isSelected &&
            endpoints.map(({ keyX, keyY, cx, cy }) => (
              <circle
                key={keyX}
                cx={cx}
                cy={cy}
                r={6}
                className={cn(
                  'fill-accent/30 stroke-accent',
                  interactive && 'pointer-events-auto cursor-grab active:cursor-grabbing'
                )}
                strokeWidth={1.5}
                onPointerDown={startDrag(annotation.id, (dx, dy) =>
                  store.getState().moveAnnotation(annotation.id, {
                    [keyX]: annotation[keyX] + dx,
                    [keyY]: annotation[keyY] + dy
                  })
                )}
              />
            ))}
        </svg>
      );
    }

    if (annotation.kind === 'label') {
      const size = annotation.radius * 2 * scale;
      return (
        <div
          key={annotation.id}
          onPointerDown={startDrag(annotation.id, (dx, dy) =>
            store.getState().moveAnnotation(annotation.id, {
              x: annotation.x + dx,
              y: annotation.y + dy
            })
          )}
          className={cn(
            'absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full font-semibold',
            interactive ? 'pointer-events-auto cursor-move' : 'pointer-events-none',
            isSelected && 'ring-2 ring-accent'
          )}
          style={{
            left: annotation.x * scale,
            top: annotation.y * scale,
            width: size,
            height: size,
            backgroundColor: annotation.color,
            color: labelTextColor(annotation.color),
            fontSize: annotation.radius * 1.1 * scale
          }}
        >
          {annotation.value}
        </div>
      );
    }

    // Text annotation: inline input while editing, draggable div otherwise.
    if (editingId === annotation.id) {
      return <TextEditInput key={annotation.id} annotation={annotation} scale={scale} />;
    }
    return (
      <div
        key={annotation.id}
        onPointerDown={startDrag(annotation.id, (dx, dy) =>
          store.getState().moveAnnotation(annotation.id, {
            x: annotation.x + dx,
            y: annotation.y + dy
          })
        )}
        onDoubleClick={() => interactive && store.getState().setEditingId(annotation.id)}
        className={cn(
          'absolute whitespace-nowrap font-medium',
          interactive ? 'pointer-events-auto cursor-move' : 'pointer-events-none',
          isSelected && 'rounded outline-2 outline-offset-2 outline-accent'
        )}
        style={{
          left: annotation.x * scale,
          top: annotation.y * scale,
          color: annotation.color,
          fontSize: annotation.fontSize * scale,
          textShadow: '0 1px 3px rgba(0,0,0,0.6)'
        }}
      >
        {annotation.text}
      </div>
    );
  }

  function renderDraft(d: Draft): JSX.Element {
    if (d.kind === 'arrow') {
      return (
        <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
          <line
            x1={d.startX * scale}
            y1={d.startY * scale}
            x2={d.endX * scale}
            y2={d.endY * scale}
            stroke={store.getState().color}
            strokeWidth={Math.max(1.5, store.getState().strokeTier * unit * scale)}
            strokeLinecap="round"
          />
        </svg>
      );
    }
    const rect = normalizeRect(d.startX, d.startY, d.endX, d.endY);
    return (
      <div
        className={cn('pointer-events-none absolute', d.kind === 'blur' && 'backdrop-blur-md')}
        style={{
          left: rect.x * scale,
          top: rect.y * scale,
          width: rect.width * scale,
          height: rect.height * scale,
          border:
            d.kind === 'rect'
              ? `${Math.max(1, store.getState().strokeTier * unit * scale)}px solid ${store.getState().color}`
              : '1px dashed var(--color-accent)'
        }}
      />
    );
  }

  const sized = stageWidth > 0;

  return (
    <div
      ref={containerRef}
      className="flex min-h-0 flex-1 items-center justify-center overflow-hidden"
    >
      <div
        ref={stageRef}
        onPointerDown={handleStagePointerDown}
        className={cn(
          'relative select-none',
          !sized && 'max-h-full max-w-full',
          tool !== 'select' && 'cursor-crosshair'
        )}
        style={{
          width: sized ? stageWidth : undefined,
          height: sized ? stageHeight : undefined,
          borderRadius: cornerRadius * scale,
          overflow: 'hidden'
        }}
      >
        <img
          src={dataUrl}
          alt="Captured screenshot"
          draggable={false}
          className={cn('block', sized ? 'h-full w-full' : 'max-h-full max-w-full')}
          onLoad={(e) => {
            const img = e.currentTarget;
            if (store.getState().imageWidth !== img.naturalWidth) {
              store.getState().init(img.naturalWidth, img.naturalHeight);
            }
          }}
        />

        {sized && (
          <div className="absolute inset-0">
            {annotations.map(renderAnnotation)}
            {draft && renderDraft(draft)}
          </div>
        )}
      </div>
    </div>
  );
}
