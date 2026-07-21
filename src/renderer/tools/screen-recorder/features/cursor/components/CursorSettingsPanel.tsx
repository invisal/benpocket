import type { JSX } from 'react';
import { useCursorStore } from '../store/cursor-store';
import { useAppStore } from '../../../app/app-store';
import { Slider } from '../../../components/ui/slider';
import { Switch } from '../../../components/ui/switch';
import { CursorStyleIcon } from './CursorStyleIcon';
import { CURSOR_STYLE_PRESETS } from '@shared/cursor-styles';
import { cn } from '../../../lib/utils';

export function CursorSettingsPanel(): JSX.Element {
  const {
    visible,
    clipToCanvas,
    style,
    size,
    smoothing,
    motionBlur,
    clickBounce,
    setVisible,
    setClipToCanvas,
    setStyle,
    setSize,
    setSmoothing,
    setMotionBlur,
    setClickBounce
  } = useCursorStore();
  const cursorPointCount = useAppStore((s) => s.lastRecording?.cursorPath.length ?? 0);

  return (
    <div className="flex flex-col gap-4">
      <p
        className={cn(
          'rounded-md px-2 py-1.5 text-[11px]',
          cursorPointCount > 0 ? 'bg-accent/10 text-accent' : 'bg-surface text-muted-foreground'
        )}
      >
        {cursorPointCount > 0
          ? `Tracking ${cursorPointCount} recorded cursor point(s) from this recording.`
          : 'No cursor movement recorded for this recording -- the icon below is a static style preview, not the real path. Record a screen (not window) source with mouse movement to see it move.'}
      </p>

      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">Show Cursor</span>
        <Switch checked={visible} onChange={setVisible} label="Show cursor" />
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">Clip to Canvas</span>
        <Switch checked={clipToCanvas} onChange={setClipToCanvas} label="Clip cursor to canvas" />
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Cursor Style
        </span>
        <div className="grid grid-cols-4 gap-2">
          {CURSOR_STYLE_PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => setStyle(preset.id)}
              title={preset.id}
              className={cn(
                'flex items-center justify-center rounded-lg border py-2 transition-colors',
                style === preset.id
                  ? 'border-accent bg-accent/10'
                  : 'border-line hover:border-accent/40'
              )}
            >
              <CursorStyleIcon fill={preset.fill} stroke={preset.stroke} />
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Size
            </span>
            <span className="text-xs text-muted-foreground">{size.toFixed(1)}</span>
          </div>
          <Slider value={size} min={2} max={20} step={0.1} onChange={setSize} />
        </div>

        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Smoothing
            </span>
            <span className="text-xs text-muted-foreground">{Math.round(smoothing * 100)}%</span>
          </div>
          <Slider value={smoothing} min={0} max={1} step={0.01} onChange={setSmoothing} />
        </div>

        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Motion Blur
            </span>
            <span className="text-xs text-muted-foreground">{Math.round(motionBlur * 100)}%</span>
          </div>
          <Slider value={motionBlur} min={0} max={1} step={0.01} onChange={setMotionBlur} />
        </div>

        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Click Bounce
            </span>
            <span className="text-xs text-muted-foreground">{clickBounce.toFixed(1)}</span>
          </div>
          <Slider value={clickBounce} min={0} max={5} step={0.1} onChange={setClickBounce} />
        </div>
      </div>
    </div>
  );
}
