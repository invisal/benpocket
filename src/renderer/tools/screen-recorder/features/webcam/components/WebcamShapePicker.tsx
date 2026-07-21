import type { JSX } from 'react';
import { useWebcamStore } from '../store/webcam-store';

export function WebcamShapePicker(): JSX.Element {
  const { shape, setShape, mirrored, setMirrored } = useWebcamStore();

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-3 gap-1.5">
        {(['circle', 'rounded-square', 'square'] as const).map((option) => (
          <button
            key={option}
            onClick={() => setShape(option)}
            className={`truncate rounded-lg border px-2 py-1 text-[11px] ${
              shape === option ? 'border-accent text-accent' : 'border-line text-muted-foreground'
            }`}
          >
            {option}
          </button>
        ))}
      </div>
      <label className="flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={mirrored}
          onChange={(e) => setMirrored(e.target.checked)}
          className="h-3.5 w-3.5 accent-accent"
        />
        Mirror
      </label>
    </div>
  );
}
