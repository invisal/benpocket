import type { JSX } from 'react';
import { Blend, Circle, Maximize2, Square, SquareUser } from 'lucide-react';
import { useScreenRecorderStore } from '../../../store/screen-recorder-store';
import { useWebcamStore } from '../store/webcam-store';
import { SliderRow } from '../../../components/ui/slider-row';
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
    shadow,
    toggleEnabled,
    setShape,
    setMirrored,
    setSize,
    setPosition,
    setShadow
  } = useWebcamStore();
  // Nothing to overlay if the camera wasn't on when this recording started
  // -- see useRecordingController.ts's `stop()`, which only sets this when
  // `startCapture`'s `webcam` option actually produced a parallel recording.
  const hasWebcamFootage = useScreenRecorderStore((s) =>
    Boolean(s.lastRecording?.webcamPreviewUrl)
  );
  const isEnabled = enabled && hasWebcamFootage;

  return (
    <div className="flex flex-col gap-3">
      <label className="flex items-center justify-between">
        <span className="text-sm font-medium">Show Webcam</span>
        <Switch
          checked={isEnabled}
          onChange={toggleEnabled}
          label="Webcam overlay"
          disabled={!hasWebcamFootage}
        />
      </label>
      <div className={cn('flex flex-col gap-3', !isEnabled && 'pointer-events-none opacity-40')}>
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-muted-foreground">Shape</span>
          <div className="grid grid-cols-3 gap-2">
            {SHAPES.map((option) => {
              const Icon = option.icon;
              return (
                <button
                  key={option.id}
                  onClick={() => setShape(option.id)}
                  className={cn(
                    'flex flex-col items-center gap-1 rounded-lg border py-1.5 text-sm font-medium transition-colors',
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

        <label className="flex items-center justify-between text-sm">
          <span className="font-medium text-muted-foreground">Mirror</span>
          <Switch
            checked={mirrored}
            onChange={(checked) => setMirrored(checked)}
            label="Mirror webcam"
            disabled={!hasWebcamFootage}
          />
        </label>

        <SliderRow
          icon={Maximize2}
          label="Size"
          value={size}
          displayValue={`${size}px`}
          min={80}
          max={360}
          step={4}
          onChange={setSize}
        />

        <SliderRow
          icon={Blend}
          label="Drop shadow"
          value={shadow}
          displayValue={`${shadow}`}
          min={0}
          max={100}
          step={1}
          onChange={setShadow}
        />

        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] text-muted-foreground">Position X</span>
            <span className="flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1.5 focus-within:ring-1 focus-within:ring-accent">
              <span className="text-[11px] text-muted-foreground">X</span>
              <input
                type="number"
                value={Math.round(position.x)}
                onChange={(e) => setPosition({ ...position, x: Number(e.target.value) })}
                className="w-full min-w-0 bg-transparent text-[11px] text-foreground outline-none"
              />
            </span>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] text-muted-foreground">Position Y</span>
            <span className="flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1.5 focus-within:ring-1 focus-within:ring-accent">
              <span className="text-[11px] text-muted-foreground">Y</span>
              <input
                type="number"
                value={Math.round(position.y)}
                onChange={(e) => setPosition({ ...position, y: Number(e.target.value) })}
                className="w-full min-w-0 bg-transparent text-[11px] text-foreground outline-none"
              />
            </span>
          </label>
        </div>
      </div>
    </div>
  );
}
