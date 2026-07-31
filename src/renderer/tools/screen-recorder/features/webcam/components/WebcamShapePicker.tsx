import type { JSX } from 'react';
import { useWebcamStore } from '../store/webcam-store';
import { Switch } from '../../../components/ui/switch';
import { SettingsRow } from '../../../components/ui/settings-row';
import { cn } from '../../../lib/utils';

const SHAPE_OPTIONS = [
  { id: 'circle', label: 'Circle' },
  { id: 'rounded-square', label: 'Rounded' },
  { id: 'square', label: 'Square' }
] as const;

export function WebcamShapePicker(): JSX.Element {
  const { shape, setShape, mirrored, setMirrored } = useWebcamStore();

  return (
    <>
      <SettingsRow title="Shape" description="Shape of the webcam overlay.">
        <div className="flex overflow-hidden rounded-lg border border-line">
          {SHAPE_OPTIONS.map((option) => (
            <button
              key={option.id}
              onClick={() => setShape(option.id)}
              className={cn(
                'px-2.5 py-1 text-xs transition-colors',
                shape === option.id
                  ? 'bg-accent text-white'
                  : 'text-muted-foreground hover:bg-surface-2'
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </SettingsRow>
      <SettingsRow title="Mirror" description="Flip the webcam preview horizontally.">
        <Switch checked={mirrored} onChange={setMirrored} label="Mirror" />
      </SettingsRow>
    </>
  );
}
