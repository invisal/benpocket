import type { JSX } from 'react';
import { Sparkles, Trash2 } from 'lucide-react';
import { useCaptionsStore } from '../store/captions-store';
import { Button } from '../../../components/ui/button';
import { cn } from '../../../lib/utils';

function formatTime(ms: number): string {
  const totalSeconds = ms / 1000;
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function CaptionsPanel(): JSX.Element {
  const { enabled, segments, toggleEnabled, setSegments } = useCaptionsStore();

  return (
    <div className="flex flex-col gap-4">
      <label className="flex items-center justify-between">
        <span className="text-xs font-medium">Show captions</span>
        <button
          onClick={toggleEnabled}
          className={cn(
            'relative h-5 w-9 rounded-full transition-colors',
            enabled ? 'bg-accent' : 'bg-white/15'
          )}
        >
          <span
            className={cn(
              'absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform',
              enabled ? 'translate-x-4.5' : 'translate-x-0.5'
            )}
          />
        </button>
      </label>

      <div className={cn('flex flex-col gap-3', !enabled && 'pointer-events-none opacity-40')}>
        <Button
          variant="secondary"
          disabled
          title="On-device transcription model isn't bundled yet"
          className="flex items-center justify-center gap-1.5 py-1.5 text-xs"
        >
          <Sparkles size={13} /> Auto-generate from audio (coming soon)
        </Button>

        {segments.length === 0 ? (
          <p className="text-xs text-white/40">
            No caption segments yet. Once on-device transcription is available, generated lines will
            show up here to edit and time.
          </p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {segments.map((segment) => (
              <div
                key={segment.id}
                className="flex items-start gap-2 rounded-lg border border-line p-1.5 text-xs"
              >
                <span className="mt-0.5 shrink-0 font-mono text-white/40">
                  {formatTime(segment.startMs)}
                </span>
                <p className="flex-1 text-white/80">{segment.text}</p>
                <button
                  onClick={() => setSegments(segments.filter((s) => s.id !== segment.id))}
                  className="shrink-0 rounded p-1 text-white/40 hover:bg-white/10 hover:text-red-400"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
