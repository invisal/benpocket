import type { JSX } from 'react';
import { Crosshair, Plus, Trash2 } from 'lucide-react';
import type { ZoomKeyframe } from '@screen-recorder/types/timeline';
import { useZoomStore } from '../store/zoom-store';
import { Slider } from '../../../components/ui/slider';
import { Button } from '../../../components/ui/button';
import { cn } from '../../../lib/utils';

function formatTime(ms: number): string {
  const totalSeconds = ms / 1000;
  const m = Math.floor(totalSeconds / 60);
  const s = (totalSeconds % 60).toFixed(1);
  return `${m}:${s.padStart(4, '0')}`;
}

const EASINGS: ZoomKeyframe['easing'][] = ['linear', 'ease-in', 'ease-out', 'ease-in-out'];
const MIN_DURATION_MS = 200;
const MAX_DURATION_MS = 4000;

interface ZoomKeyframeEditorProps {
  /** Current preview position (ms, source-relative) -- "Add keyframe here" targets this. */
  currentTimeMs: number;
  /** Recording's native resolution, when known -- lets position be edited in exact source pixels rather than only percent. */
  sourceResolution: { width: number; height: number } | null;
}

/** A number input that only commits on blur/Enter, so mid-typing states (e.g. an empty field) don't get clamped away as you type. */
function CoordinateInput({
  value,
  max,
  onCommit
}: {
  value: number;
  max: number;
  onCommit: (value: number) => void;
}): JSX.Element {
  return (
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
      className="w-full rounded-md border border-line bg-transparent px-1.5 py-1 text-[11px] text-white/80 outline-none focus:border-accent"
    />
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
    setMode,
    addKeyframe,
    removeKeyframe,
    updateKeyframe,
    armPositioning,
    disarmPositioning
  } = useZoomStore();
  const sorted = [...keyframes].sort((a, b) => a.atMs - b.atMs);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-white/40">Zoom mode</span>
        <div className="grid grid-cols-2 gap-2">
          {(['auto', 'manual'] as const).map((option) => (
            <button
              key={option}
              onClick={() => setMode(option)}
              className={cn(
                'rounded-lg border py-1.5 text-xs font-medium capitalize transition-colors',
                mode === option
                  ? 'border-accent bg-accent/10 text-accent'
                  : 'border-line text-white/60 hover:border-white/20'
              )}
            >
              {option}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-white/30">
          {mode === 'auto'
            ? 'Zoom windows trigger on real clicks recorded during capture, and follow the recorded cursor path for the duration of each zoom.'
            : 'Add keyframes manually at the point you’re currently previewing.'}
        </p>
      </div>

      <Button
        variant="secondary"
        onClick={() => armPositioning(addKeyframe(currentTimeMs))}
        className="flex items-center justify-center gap-1.5 py-1.5 text-xs"
      >
        <Plus size={13} /> Add keyframe at {formatTime(currentTimeMs)}
      </Button>

      {armedKeyframeId && (
        <p className="rounded-md bg-accent/10 px-2 py-1.5 text-[11px] text-accent">
          Click anywhere on the preview to set that keyframe&apos;s zoom target.
        </p>
      )}

      <div className="flex flex-col gap-2">
        {sorted.length === 0 && <p className="text-xs text-white/40">No zoom keyframes yet.</p>}
        {sorted.map((kf) => {
          const fixedPosition = kf.position === 'auto-cursor' ? null : kf.position;
          const pixelX =
            fixedPosition && sourceResolution
              ? Math.round(fixedPosition.x * sourceResolution.width)
              : null;
          const pixelY =
            fixedPosition && sourceResolution
              ? Math.round(fixedPosition.y * sourceResolution.height)
              : null;

          return (
            <div key={kf.id} className="flex flex-col gap-2 rounded-lg border border-line p-2.5">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-white/70">{formatTime(kf.atMs)}</span>
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
                        : 'text-white/40 hover:bg-white/10 hover:text-white/70'
                    )}
                  >
                    <Crosshair size={12} />
                    {fixedPosition ? 'Set point' : 'Follows cursor'}
                  </button>
                  <button
                    onClick={() => removeKeyframe(kf.id)}
                    className="rounded p-1 text-white/40 hover:bg-white/10 hover:text-red-400"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              {fixedPosition && (
                <div className="flex items-center gap-2">
                  <div className="grid flex-1 grid-cols-2 gap-1.5">
                    <CoordinateInput
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
                  <span className="shrink-0 text-[10px] text-white/30">
                    {sourceResolution ? 'px' : '%'}
                  </span>
                  <button
                    onClick={() => updateKeyframe(kf.id, { position: 'auto-cursor' })}
                    title="Follow the recorded cursor instead of this fixed point"
                    className="shrink-0 text-[10px] text-white/40 underline decoration-dotted hover:text-white/70"
                  >
                    Follow cursor
                  </button>
                </div>
              )}

              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-white/40">Depth</span>
                  <span className="text-[11px] text-white/50">{kf.depth.toFixed(1)}×</span>
                </div>
                <Slider
                  value={kf.depth}
                  min={1}
                  max={4}
                  step={0.1}
                  onChange={(depth) => updateKeyframe(kf.id, { depth })}
                />
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-white/40">Duration</span>
                  <span className="text-[11px] text-white/50">
                    {(kf.durationMs / 1000).toFixed(1)}s
                  </span>
                </div>
                <Slider
                  value={kf.durationMs}
                  min={MIN_DURATION_MS}
                  max={MAX_DURATION_MS}
                  step={50}
                  onChange={(durationMs) => updateKeyframe(kf.id, { durationMs })}
                />
              </div>

              <div className="flex gap-1">
                {EASINGS.map((easing) => (
                  <button
                    key={easing}
                    onClick={() => updateKeyframe(kf.id, { easing })}
                    className={cn(
                      'flex-1 rounded-md border px-1.5 py-1 text-[10px] font-medium transition-colors',
                      kf.easing === easing
                        ? 'border-accent text-accent'
                        : 'border-line text-white/50 hover:border-white/20'
                    )}
                  >
                    {easing}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
