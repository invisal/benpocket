import type { JSX, ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import { Crosshair, Plus, Trash2 } from 'lucide-react';
import type { ZoomKeyframe } from '@screen-recorder/types/timeline';
import type { SourceResolution } from '@screen-recorder/types/editor';
import { ZOOM_MIN_DURATION_MS } from '@shared/constants';
import { useZoomStore } from '../store/zoom-store';
import { useTimelineStore } from '../../timeline/store/timeline-store';
import { Slider } from '../../../components/ui/slider';
import { Button } from '@renderer/components/ui/Button';
import { cn } from '../../../lib/utils';

function formatTime(ms: number): string {
  const totalSeconds = ms / 1000;
  const m = Math.floor(totalSeconds / 60);
  const s = (totalSeconds % 60).toFixed(1);
  return `${m}:${s.padStart(4, '0')}`;
}

const EASINGS: ZoomKeyframe['easing'][] = ['linear', 'ease-in', 'ease-out', 'ease-in-out'];
// zoom-resolve.ts clamps this to half of a keyframe's own duration, so a
// short keyframe degrades to a plain ease-in-then-out rather than clipping.
export const MIN_HOLD_TRANSITION_MS = 50;
export const MAX_HOLD_TRANSITION_MS = 2000;

function SliderField({
  label,
  valueLabel,
  children
}: {
  label: string;
  valueLabel: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-medium text-muted-foreground">{label}</span>
        <span className="text-[11px] text-muted-foreground">{valueLabel}</span>
      </div>
      {children}
    </div>
  );
}

interface ZoomKeyframeEditorProps {
  /** Current preview position (ms, source-relative) -- "Add keyframe here" targets this. */
  currentTimeMs: number;
  /** Recording's native resolution, when known -- lets position be edited in exact source pixels rather than only percent. */
  sourceResolution: SourceResolution | null;
}

/** A number input that only commits on blur/Enter, so mid-typing states (e.g. an empty field) don't get clamped away as you type. */
function CoordinateInput({
  prefix,
  value,
  max,
  onCommit
}: {
  prefix: string;
  value: number;
  max: number;
  onCommit: (value: number) => void;
}): JSX.Element {
  return (
    <span className="flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1.5 focus-within:ring-1 focus-within:ring-accent">
      <span className="text-[11px] text-muted-foreground">{prefix}</span>
      <input
        type="number"
        min={0}
        max={max}
        defaultValue={value}
        key={value}
        onBlur={(e) => {
          const next = Number(e.target.value);
          if (Number.isFinite(next)) onCommit(Math.min(max, Math.max(0, Math.round(next))));
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
        className="w-full min-w-0 bg-transparent text-[11px] text-foreground outline-none"
      />
    </span>
  );
}

/**
 * Full settings for a single keyframe -- position, zoom level, duration,
 * hold transition, easing. Shown only for whichever keyframe is selected
 * (clicking its pill in ZoomTrack, or just-added -- see ZoomKeyframeEditor
 * below), rather than listing every keyframe's full settings inline, which
 * got unreadable fast with more than a couple of them.
 */
function KeyframeDetailPanel({
  kf,
  armedKeyframeId,
  sourceResolution,
  sourceDurationMs,
  armPositioning,
  disarmPositioning,
  removeKeyframe,
  updateKeyframe
}: {
  kf: ZoomKeyframe;
  armedKeyframeId: string | null;
  sourceResolution: SourceResolution | null;
  /** The recording's own length -- a keyframe's duration can run right up to this (or the next keyframe, whichever's closer), not some arbitrary fixed cap. */
  sourceDurationMs: number;
  armPositioning: (id: string) => void;
  disarmPositioning: () => void;
  removeKeyframe: (id: string) => void;
  updateKeyframe: (
    id: string,
    patch: Partial<Omit<ZoomKeyframe, 'id'>>,
    sourceDurationMs?: number
  ) => void;
}): JSX.Element {
  const fixedPosition = kf.position === 'auto-cursor' ? null : kf.position;
  const pixelX =
    fixedPosition && sourceResolution ? Math.round(fixedPosition.x * sourceResolution.width) : null;
  const pixelY =
    fixedPosition && sourceResolution
      ? Math.round(fixedPosition.y * sourceResolution.height)
      : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs text-muted-foreground">{formatTime(kf.atMs)}</span>
        <div className="flex items-center gap-1">
          <button
            onClick={() =>
              armedKeyframeId === kf.id ? disarmPositioning() : armPositioning(kf.id)
            }
            title="Click the preview to set this keyframe's zoom target"
            className={cn(
              'flex items-center gap-1 rounded px-1.5 py-1 text-[10px] font-medium',
              armedKeyframeId === kf.id
                ? 'bg-accent/20 text-accent'
                : 'text-muted-foreground hover:bg-surface-2 hover:text-foreground'
            )}
          >
            <Crosshair size={12} />
            {fixedPosition ? 'Set point' : 'Follows cursor'}
          </button>
          <button
            onClick={() => removeKeyframe(kf.id)}
            className="rounded p-1 text-muted-foreground hover:bg-surface-2 hover:text-danger"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {fixedPosition && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <div className="grid flex-1 grid-cols-2 gap-1.5">
              <CoordinateInput
                prefix="X"
                value={pixelX ?? Math.round(fixedPosition.x * 100)}
                max={sourceResolution ? sourceResolution.width : 100}
                onCommit={(next) =>
                  updateKeyframe(kf.id, {
                    position: {
                      x: sourceResolution ? next / sourceResolution.width : next / 100,
                      y: fixedPosition.y
                    }
                  })
                }
              />
              <CoordinateInput
                prefix="Y"
                value={pixelY ?? Math.round(fixedPosition.y * 100)}
                max={sourceResolution ? sourceResolution.height : 100}
                onCommit={(next) =>
                  updateKeyframe(kf.id, {
                    position: {
                      x: fixedPosition.x,
                      y: sourceResolution ? next / sourceResolution.height : next / 100
                    }
                  })
                }
              />
            </div>
            <span className="shrink-0 text-[10px] text-muted-foreground/70">
              {sourceResolution ? 'px' : '%'}
            </span>
            <button
              onClick={() => updateKeyframe(kf.id, { position: 'auto-cursor' })}
              title="Follow the recorded cursor instead of this fixed point"
              className="shrink-0 text-[10px] text-muted-foreground underline decoration-dotted hover:text-muted-foreground"
            >
              Follow cursor
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <SliderField label="Zoom level" valueLabel={`${kf.depth.toFixed(1)}×`}>
          <Slider
            value={kf.depth}
            min={1}
            max={4}
            step={0.1}
            onChange={(depth) => updateKeyframe(kf.id, { depth })}
          />
        </SliderField>

        <SliderField label="Duration" valueLabel={`${(kf.durationMs / 1000).toFixed(1)}s`}>
          <Slider
            value={kf.durationMs}
            min={ZOOM_MIN_DURATION_MS}
            max={Math.max(ZOOM_MIN_DURATION_MS, sourceDurationMs - kf.atMs)}
            step={50}
            onChange={(durationMs) => updateKeyframe(kf.id, { durationMs }, sourceDurationMs)}
          />
        </SliderField>

        <SliderField
          label="Hold transition"
          valueLabel={`${(kf.holdTransitionMs / 1000).toFixed(2)}s`}
        >
          <Slider
            value={kf.holdTransitionMs}
            min={MIN_HOLD_TRANSITION_MS}
            max={MAX_HOLD_TRANSITION_MS}
            step={50}
            onChange={(holdTransitionMs) => updateKeyframe(kf.id, { holdTransitionMs })}
          />
        </SliderField>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] font-medium text-muted-foreground">Easing</span>
        <div className="flex gap-1">
          {EASINGS.map((easing) => (
            <button
              key={easing}
              onClick={() => updateKeyframe(kf.id, { easing })}
              className={cn(
                'flex-1 rounded-md border px-1.5 py-1 text-[10px] font-medium transition-colors',
                kf.easing === easing
                  ? 'border-accent text-accent'
                  : 'border-line text-muted-foreground hover:border-accent/40'
              )}
            >
              {easing}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ZoomKeyframeEditor({
  currentTimeMs,
  sourceResolution
}: ZoomKeyframeEditorProps): JSX.Element {
  const {
    mode,
    keyframes,
    armedKeyframeId,
    selectedKeyframeId,
    setMode,
    addKeyframe,
    removeKeyframe,
    updateKeyframe,
    armPositioning,
    disarmPositioning,
    setSelectedKeyframeId
  } = useZoomStore();
  const sourceDurationMs = useTimelineStore((s) => s.sourceDurationMs);
  const sorted = [...keyframes].sort((a, b) => a.atMs - b.atMs);
  const selected = sorted.find((k) => k.id === selectedKeyframeId) ?? null;

  // Clicking a pill in ZoomTrack (which renders independently of this
  // panel, in CutTimeline) sets `selectedKeyframeId` -- scroll the detail
  // panel into view here so switching to the Zoom panel actually lands you
  // on it instead of leaving you to hunt for it.
  const detailPanelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!selectedKeyframeId) return;
    detailPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [selectedKeyframeId]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium text-muted-foreground">Zoom mode</span>
        <div className="grid grid-cols-2 gap-2">
          {(['auto', 'manual'] as const).map((option) => (
            <button
              key={option}
              onClick={() => setMode(option)}
              className={cn(
                'rounded-lg border py-1.5 text-xs font-medium capitalize transition-colors',
                mode === option
                  ? 'border-accent bg-accent/10 text-accent'
                  : 'border-line text-muted-foreground hover:border-accent/40'
              )}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      <Button
        variant="secondary"
        onClick={() => {
          const id = addKeyframe(currentTimeMs, sourceDurationMs);
          armPositioning(id);
          setSelectedKeyframeId(id);
        }}
        className="flex items-center justify-center gap-1.5 py-1.5 text-xs"
      >
        <Plus size={13} /> Add keyframe at {formatTime(currentTimeMs)}
      </Button>

      {armedKeyframeId && (
        <p className="rounded-md bg-accent/10 px-2 py-1.5 text-[11px] text-accent">
          Click anywhere on the preview to set that keyframe&apos;s zoom target.
        </p>
      )}

      {sorted.length === 0 && (
        <p className="text-xs text-muted-foreground">No zoom keyframes yet.</p>
      )}

      {sorted.length > 0 && !selected && (
        <p className="text-xs text-muted-foreground">
          Click a keyframe on the timeline below to edit it.
        </p>
      )}

      {selected && (
        <div ref={detailPanelRef}>
          <KeyframeDetailPanel
            kf={selected}
            armedKeyframeId={armedKeyframeId}
            sourceResolution={sourceResolution}
            sourceDurationMs={sourceDurationMs}
            armPositioning={armPositioning}
            disarmPositioning={disarmPositioning}
            removeKeyframe={removeKeyframe}
            updateKeyframe={updateKeyframe}
          />
        </div>
      )}
    </div>
  );
}
