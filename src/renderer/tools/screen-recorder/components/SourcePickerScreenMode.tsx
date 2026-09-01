import type { JSX } from 'react';
import { cn } from 'cnfast';
import { Button } from '@renderer/components/ui/Button';
import type { CaptureSource } from '@screen-recorder/types/recording';

/** Screen-mode UI: one clickable panel per display, plus a centered title+Start HUD for the resolved target. */
export function SourcePickerScreenMode({
  matching,
  targetSource,
  origin,
  onSelect,
  onStartClick,
  showHud
}: {
  matching: CaptureSource[];
  targetSource: CaptureSource | null;
  origin: { x: number; y: number };
  onSelect: (source: CaptureSource) => void;
  onStartClick: () => void;
  showHud: boolean;
}): JSX.Element {
  return (
    <>
      {matching.map(
        (source) =>
          source.displayBounds && (
            <button
              key={source.id}
              onClick={(event) => {
                event.stopPropagation();
                onSelect(source);
              }}
              className={cn(
                'group absolute flex items-center justify-center border-2 bg-black/35 transition-colors hover:border-accent hover:bg-black/60',
                targetSource?.id === source.id ? 'border-accent bg-black/60' : 'border-transparent'
              )}
              style={{
                left: source.displayBounds.x - origin.x,
                top: source.displayBounds.y - origin.y,
                width: source.displayBounds.width,
                height: source.displayBounds.height
              }}
            ></button>
          )
      )}

      {/* pointer-events-none so this doesn't block clicks through to the panels above except the button itself. */}
      <div className="pointer-events-none fixed inset-0 flex flex-col items-center justify-center gap-6">
        {showHud && targetSource && (
          <>
            <div className="flex flex-col items-center gap-1 text-center">
              <h1 className="max-w-lg truncate text-2xl font-semibold text-white drop-shadow-sm">
                {targetSource.name}
              </h1>
              {targetSource.displayBounds && (
                <p className="text-white/60">
                  {Math.round(targetSource.displayBounds.width)}×
                  {Math.round(targetSource.displayBounds.height)}
                </p>
              )}
            </div>
            <Button
              size="lg"
              onClick={(event) => {
                event.stopPropagation();
                onStartClick();
              }}
              className="pointer-events-auto gap-2 rounded-full shadow-2xl"
            >
              <span className="h-2.5 w-2.5 rounded-full bg-red-600" />
              Start Recording
            </Button>
          </>
        )}
      </div>
    </>
  );
}
