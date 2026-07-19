import type { JSX } from 'react';
import { useRecordingStore } from '../store/recording-store';

export function AutoZoomToggle(): JSX.Element {
  const autoZoomEnabled = useRecordingStore((state) => state.autoZoomEnabled);
  const setAutoZoomEnabled = useRecordingStore((state) => state.setAutoZoomEnabled);

  return (
    <label className="flex items-center gap-2 text-xs">
      <input
        type="checkbox"
        checked={autoZoomEnabled}
        onChange={(e) => setAutoZoomEnabled(e.target.checked)}
        className="h-3.5 w-3.5 accent-accent"
      />
      Auto Zoom
    </label>
  );
}
