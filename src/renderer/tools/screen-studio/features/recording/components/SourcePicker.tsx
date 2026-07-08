import type { JSX } from 'react';
import { useEffect, useState } from 'react';
import type { CaptureSource } from '@screen-studio/types/recording';
import { useRecordingStore } from '../store/recording-store';

export function SourcePicker(): JSX.Element {
  const [sources, setSources] = useState<CaptureSource[]>([]);
  const [error, setError] = useState<string | null>(null);
  const selectedSource = useRecordingStore((state) => state.selectedSource);
  const setSelectedSource = useRecordingStore((state) => state.setSelectedSource);

  useEffect(() => {
    if (!window.screenStudio) {
      // Should only happen if the preload script failed to load -- see
      // main/windows/main-window.ts's preload-error listener for the
      // corresponding main-process log.
      setError('Recording API unavailable (preload script did not load). Check the console.');
      return;
    }
    window.screenStudio.recording
      .getCaptureSources()
      .then((next) => {
        setSources(next);
        if (!selectedSource && next.length > 0) setSelectedSource(next[0]);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) {
    return <p className="text-xs text-red-400">{error}</p>;
  }

  return (
    <div className="grid grid-cols-4 gap-3">
      {sources.map((source) => (
        <button
          key={source.id}
          onClick={() => setSelectedSource(source)}
          className={`rounded-xl border p-2 text-left ${
            selectedSource?.id === source.id
              ? 'border-accent bg-surface-raised'
              : 'border-white/10 bg-surface-raised hover:border-accent/60'
          }`}
        >
          <img src={source.thumbnailDataUrl} alt={source.name} className="rounded-lg" />
          <p className="mt-1 truncate text-xs">{source.name}</p>
        </button>
      ))}
    </div>
  );
}
