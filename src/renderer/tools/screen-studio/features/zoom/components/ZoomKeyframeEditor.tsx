import type { JSX } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { ZoomKeyframe } from '@screen-studio/types/timeline';
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

interface ZoomKeyframeEditorProps {
  /** Current preview position (ms, source-relative) -- "Add keyframe here" targets this. */
  currentTimeMs: number;
}

export function ZoomKeyframeEditor({ currentTimeMs }: ZoomKeyframeEditorProps): JSX.Element {
  const { mode, keyframes, setMode, addKeyframe, removeKeyframe, updateKeyframe } = useZoomStore();
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
            ? 'Zooms follow keyframe timing but focus on a fixed center point (no cursor track is recorded).'
            : 'Add keyframes manually at the point you’re currently previewing.'}
        </p>
      </div>

      <Button
        variant="secondary"
        onClick={() => addKeyframe(currentTimeMs)}
        className="flex items-center justify-center gap-1.5 py-1.5 text-xs"
      >
        <Plus size={13} /> Add keyframe at {formatTime(currentTimeMs)}
      </Button>

      <div className="flex flex-col gap-2">
        {sorted.length === 0 && <p className="text-xs text-white/40">No zoom keyframes yet.</p>}
        {sorted.map((kf) => (
          <div key={kf.id} className="flex flex-col gap-2 rounded-lg border border-line p-2.5">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-white/70">{formatTime(kf.atMs)}</span>
              <button
                onClick={() => removeKeyframe(kf.id)}
                className="rounded p-1 text-white/40 hover:bg-white/10 hover:text-red-400"
              >
                <Trash2 size={13} />
              </button>
            </div>

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
        ))}
      </div>
    </div>
  );
}
