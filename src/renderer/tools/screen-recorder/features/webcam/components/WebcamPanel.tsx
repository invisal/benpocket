import type { JSX } from 'react';
import { Circle, Square, SquareUser } from 'lucide-react';
import { useAppStore } from '../../../app/app-store';
import { useWebcamStore } from '../store/webcam-store';
import { Slider } from '../../../components/ui/slider';
import { Switch } from '../../../components/ui/switch';
import { cn } from '../../../lib/utils';

const SHAPES: { id: 'circle' | 'rounded-square' | 'square'; label: string; icon: typeof Circle }[] =
  [
    { id: 'circle', label: 'Circle', icon: Circle },
    { id: 'rounded-square', label: 'Rounded', icon: SquareUser },
    { id: 'square', label: 'Square', icon: Square }
  ];

/**
 * Richer webcam PiP panel for the Editor page -- covers everything
 * `WebcamShapePicker` (used on the Record setup page) doesn't: enable
 * toggle, size, and drag-to-position via the preview overlay
 * (`PreviewStage`'s draggable PiP), whose live x/y land here too so both can
 * edit the same `webcam-store` state.
 */
export function WebcamPanel(): JSX.Element {
  const {
    enabled,
    shape,
    mirrored,
    size,
    position,
    toggleEnabled,
    setShape,
    setMirrored,
    setSize,
    setPosition
  } = useWebcamStore();
  // Nothing to overlay if the camera wasn't on when this recording started
  // -- see useRecordingController.ts's `stop()`, which only sets this when
  // `startCapture`'s `webcam` option actually produced a parallel recording.
  const hasWebcamFootage = useAppStore((s) => Boolean(s.lastRecording?.webcamPreviewUrl));
  const isEnabled = enabled && hasWebcamFootage;

  return (
    <div className="flex flex-col gap-4">
      <label className="flex items-center justify-between">
        <span className="text-xs font-medium">Webcam overlay</span>
        <Switch
          checked={isEnabled}
          onChange={toggleEnabled}
          label="Webcam overlay"
          disabled={!hasWebcamFootage}
        />
      </label>
      {!hasWebcamFootage && (
        <p className="-mt-2 text-[11px] text-muted-foreground/70">
          Turn on your camera before recording to use a webcam overlay.
        </p>
      )}

      <div className={cn('flex flex-col gap-4', !isEnabled && 'pointer-events-none opacity-40')}>
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Shape
          </span>
          <div className="grid grid-cols-3 gap-2">
            {SHAPES.map((option) => {
              const Icon = option.icon;
              return (
                <button
                  key={option.id}
                  onClick={() => setShape(option.id)}
                  className={cn(
                    'flex flex-col items-center gap-1 rounded-lg border py-1.5 text-xs font-medium transition-colors',
                    shape === option.id
                      ? 'border-accent bg-accent/10 text-accent'
                      : 'border-line text-muted-foreground hover:border-accent/40'
                  )}
                >
                  <Icon size={16} />
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        <label className="flex items-center justify-between text-xs">
          <span className="font-medium uppercase tracking-wide text-muted-foreground">Mirror</span>
          <input
            type="checkbox"
            checked={mirrored}
            onChange={(e) => setMirrored(e.target.checked)}
            className="h-4 w-4 accent-accent"
          />
        </label>

        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Size
            </span>
            <span className="text-xs text-muted-foreground">{size}px</span>
          </div>
          <Slider value={size} min={80} max={360} step={4} onChange={setSize} />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              X
            </span>
            <input
              type="number"
              value={Math.round(position.x)}
              onChange={(e) => setPosition({ ...position, x: Number(e.target.value) })}
              className="rounded-lg border border-line bg-surface px-2 py-1.5 text-xs"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Y
            </span>
            <input
              type="number"
              value={Math.round(position.y)}
              onChange={(e) => setPosition({ ...position, y: Number(e.target.value) })}
              className="rounded-lg border border-line bg-surface px-2 py-1.5 text-xs"
            />
          </label>
        </div>
        <p className="text-[11px] text-muted-foreground/70">
          Or drag the PiP directly on the preview above.
        </p>
      </div>
    </div>
  );
}
