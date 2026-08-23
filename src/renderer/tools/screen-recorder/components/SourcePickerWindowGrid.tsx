import type { JSX } from 'react';
import { Camera } from 'lucide-react';
import { cn } from 'cnfast';
import type { CaptureSource } from '@screen-recorder/types/recording';

/** Window-mode UI: a thumbnail grid, since desktopCapturer exposes no on-screen position for arbitrary windows. */
export function SourcePickerWindowGrid({
  sources,
  targetSource,
  onSelect
}: {
  sources: CaptureSource[];
  targetSource: CaptureSource | null;
  onSelect: (source: CaptureSource) => void;
}): JSX.Element {
  return (
    <div
      className="flex h-full w-full items-center justify-center bg-black/40"
      onClick={(event) => event.stopPropagation()}
    >
      <div className="grid max-h-[80vh] max-w-[80vw] grid-cols-4 gap-4 overflow-auto p-4">
        {sources.map((source) => (
          <button
            key={source.id}
            onClick={() => onSelect(source)}
            title={source.name}
            className={cn(
              'group relative overflow-hidden rounded-xl border bg-zinc-900 text-left transition-colors hover:border-accent',
              targetSource?.id === source.id ? 'border-accent' : 'border-white/10'
            )}
          >
            <div className="relative">
              <img
                src={source.thumbnailDataUrl ?? ''}
                alt={source.name}
                className="aspect-video w-full object-cover opacity-80 transition-opacity group-hover:opacity-30"
              />
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <Camera size={28} className="text-white" />
                <span className="text-[10px] text-white">Esc to cancel</span>
              </div>
            </div>
            <p className="truncate px-2 py-1.5 text-[11px] text-white/70">{source.name}</p>
          </button>
        ))}
        {sources.length === 0 && (
          <p className="col-span-4 text-center text-white/50">No windows available.</p>
        )}
      </div>
    </div>
  );
}
