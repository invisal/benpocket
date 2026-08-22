import type { JSX } from 'react';
import { useEffect, useRef } from 'react';
import { Gauge, Plus, Timer, ZoomIn } from 'lucide-react';
import type { ZoomKeyframe } from '@screen-recorder/types/timeline';
import type { SourceResolution } from '@screen-recorder/types/editor';
import { ZOOM_MIN_DURATION_MS } from '@shared/constants';
import { useZoomStore } from '../store/zoom-store';
import { useTimelineStore } from '../../timeline/store/timeline-store';
import { selectZoomKeyframe } from '../../../store/selection-coordinator';
import { SliderRow } from '../../../components/ui/slider-row';
import { Button } from '@renderer/components/ui/Button';
import { Select } from '@renderer/components/ui/Select';
import { ZoomFocalPreview } from './ZoomFocalPreview';
import { cn } from '../../../lib/utils';

function formatTime(ms: number): string {
  const totalSeconds = ms / 1000;
  const m = Math.floor(totalSeconds / 60);
  const s = (totalSeconds % 60).toFixed(1);
  return `${m}:${s.padStart(4, '0')}`;
}

const EASINGS: ZoomKeyframe['easing'][] = ['linear', 'ease-in', 'ease-out', 'ease-in-out'];
const EASING_LABELS: Record<ZoomKeyframe['easing'], string> = {
  linear: 'Linear',
  'ease-in': 'Ease In',
  'ease-out': 'Ease Out',
  'ease-in-out': 'Ease In Out'
};
// zoom-resolve.ts clamps this to half of a keyframe's own duration, so a
// short keyframe degrades to a plain ease-in-then-out rather than clipping.
export const MIN_HOLD_TRANSITION_MS = 50;
export const MAX_HOLD_TRANSITION_MS = 2000;

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
  sourceResolution,
  sourceDurationMs,
  updateKeyframe
}: {
  kf: ZoomKeyframe;
  sourceResolution: SourceResolution | null;
  /** The recording's own length -- a keyframe's duration can run right up to this (or the next keyframe, whichever's closer), not some arbitrary fixed cap. */
  sourceDurationMs: number;
  updateKeyframe: (
    id: string,
    patch: Partial<Omit<ZoomKeyframe, 'id'>>,
    sourceDurationMs?: number
  ) => void;
}): JSX.Element {
  const fixedPosition = kf.position === 'auto-cursor' ? null : kf.position;

  return (
    <div className="flex flex-col gap-3">
      {fixedPosition && (
        <div className="flex flex-col gap-1.5">
          <ZoomFocalPreview
            atMs={kf.atMs}
            durationMs={kf.durationMs}
            position={fixedPosition}
            onPositionChange={(position) => updateKeyframe(kf.id, { position })}
            aspectRatio={
              sourceResolution ? sourceResolution.width / sourceResolution.height : undefined
            }
          />
          <div className="flex items-center gap-2">
            <div className="grid flex-1 grid-cols-2 gap-1.5">
              <CoordinateInput
                prefix="X"
                value={
                  sourceResolution
                    ? Math.round(fixedPosition.x * sourceResolution.width)
                    : Math.round(fixedPosition.x * 100)
                }
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
                value={
                  sourceResolution
                    ? Math.round(fixedPosition.y * sourceResolution.height)
                    : Math.round(fixedPosition.y * 100)
                }
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
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4">
        <SliderRow
          icon={ZoomIn}
          label="Zoom level"
          value={kf.depth}
          displayValue={`${kf.depth.toFixed(1)}×`}
          min={1}
          max={4}
          step={0.1}
          onChange={(depth) => updateKeyframe(kf.id, { depth })}
        />

        <SliderRow
          icon={Timer}
          label="Duration"
          value={kf.durationMs}
          displayValue={`${(kf.durationMs / 1000).toFixed(1)}s`}
          min={ZOOM_MIN_DURATION_MS}
          max={Math.max(ZOOM_MIN_DURATION_MS, sourceDurationMs - kf.atMs)}
          step={50}
          onChange={(durationMs) => updateKeyframe(kf.id, { durationMs }, sourceDurationMs)}
        />

        <SliderRow
          icon={Gauge}
          label="Speed"
          value={kf.holdTransitionMs}
          displayValue={`${(kf.holdTransitionMs / 1000).toFixed(2)}s`}
          min={MIN_HOLD_TRANSITION_MS}
          max={MAX_HOLD_TRANSITION_MS}
          step={50}
          onChange={(holdTransitionMs) => updateKeyframe(kf.id, { holdTransitionMs })}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] font-medium text-muted-foreground">Easing</span>
        <Select.Root
          value={kf.easing}
          onValueChange={(value) =>
            updateKeyframe(kf.id, { easing: value as ZoomKeyframe['easing'] })
          }
        >
          <Select.Trigger size="sm" className="w-full justify-between">
            <span className="truncate">{EASING_LABELS[kf.easing]}</span>
          </Select.Trigger>
          <Select.Content side="bottom" align="start">
            {EASINGS.map((easing) => (
              <Select.Item key={easing} value={easing}>
                {EASING_LABELS[easing]}
              </Select.Item>
            ))}
          </Select.Content>
        </Select.Root>
      </div>
    </div>
  );
}

export function ZoomKeyframeEditor({
  currentTimeMs,
  sourceResolution
}: ZoomKeyframeEditorProps): JSX.Element {
  const { mode, keyframes, selectedKeyframeId, setMode, addKeyframe, updateKeyframe } =
    useZoomStore();
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

  // One toggle, two jobs -- avoids showing a second, near-identical
  // Auto/Manual control inside the keyframe detail panel below. With a
  // keyframe selected (from clicking its pill in ZoomTrack, or just added),
  // it reflects/edits *that keyframe's* own position type. With nothing
  // selected, it falls back to the global `mode` (used once, right after
  // recording stops, to decide whether to auto-seed zoom keyframes from
  // click data -- see useRecordingController.ts) and defaults to "auto".
  const activeZoomMode = selected
    ? selected.position === 'auto-cursor'
      ? 'auto'
      : 'manual'
    : mode;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-muted-foreground">Zoom mode</span>
        <div className="grid grid-cols-2 gap-2">
          {(['auto', 'manual'] as const).map((option) => (
            <button
              key={option}
              onClick={() => {
                if (selected) {
                  const fixedPosition =
                    selected.position === 'auto-cursor' ? null : selected.position;
                  updateKeyframe(selected.id, {
                    position:
                      option === 'auto' ? 'auto-cursor' : (fixedPosition ?? { x: 0.5, y: 0.5 })
                  });
                } else {
                  setMode(option);
                }
              }}
              className={cn(
                'rounded-lg border py-1.5 text-sm font-medium capitalize transition-colors',
                activeZoomMode === option
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
          selectZoomKeyframe(id);
        }}
        className="flex items-center justify-center gap-1.5 py-1.5 text-sm"
      >
        <Plus size={13} /> Add keyframe at {formatTime(currentTimeMs)}
      </Button>

      {selected && selected.position !== 'auto-cursor' && (
        <p className="rounded-md bg-accent/10 px-2 py-1.5 text-[11px] text-accent">
          Drag the dot in the preview below to set that keyframe&apos;s zoom target.
        </p>
      )}

      {sorted.length === 0 && (
        <p className="text-sm text-muted-foreground">No zoom keyframes yet.</p>
      )}

      {sorted.length > 0 && !selected && (
        <p className="text-sm text-muted-foreground">
          Click a keyframe on the timeline below to edit it.
        </p>
      )}

      {selected && (
        <div ref={detailPanelRef}>
          <KeyframeDetailPanel
            kf={selected}
            sourceResolution={sourceResolution}
            sourceDurationMs={sourceDurationMs}
            updateKeyframe={updateKeyframe}
          />
        </div>
      )}
    </div>
  );
}
