import { useCallback, useEffect, useState } from 'react';
import type { CaptureSource } from '@screen-recorder/types/recording';
import { useRecordingStore } from '../store/recording-store';

// Should only be missing if the preload script failed to load -- see
// main/windows/main-window.ts's preload-error listener for the corresponding
// main-process log.
const PRELOAD_MISSING_ERROR =
  'Recording API unavailable (preload script did not load). Check the console.';

export interface UseCaptureSourcesResult {
  sources: CaptureSource[];
  bootedSimulatorName: string | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

/**
 * Shared source-list fetch behind both the source grid (SourcePicker) and
 * the focus-view filmstrip (SourceFocusView) -- a single fetch/refresh so
 * the two never drift out of sync with each other.
 */
export function useCaptureSources(): UseCaptureSourcesResult {
  const [sources, setSources] = useState<CaptureSource[]>([]);
  const [bootedSimulatorName, setBootedSimulatorName] = useState<string | null>(null);
  // Starts true (the mount effect below fetches immediately) rather than
  // being set synchronously inside that effect -- an effect body setting
  // state directly (vs. inside an async callback) triggers a cascading
  // extra render, which is what react-hooks/set-state-in-effect flags.
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(() =>
    window.screenRecorder ? null : PRELOAD_MISSING_ERROR
  );
  const selectedSource = useRecordingStore((state) => state.selectedSource);
  const setSelectedSource = useRecordingStore((state) => state.setSelectedSource);

  const fetchSources = useCallback(() => {
    if (!window.screenRecorder) return;
    Promise.all([
      window.screenRecorder.recording.getCaptureSources(),
      // Just for the "iOS Simulator" badge below -- the Simulator window
      // records like any other window source (see screen-source-provider.ts,
      // which is what actually tags it with cursor-trackable displayBounds).
      // xcrun/simctl being unavailable, or nothing booted, just means no
      // badge shows -- not an error.
      window.screenRecorder.simulator.getBootedName().catch(() => null)
    ])
      .then(([nextSources, nextBootedSimulatorName]) => {
        setSources(nextSources);
        setBootedSimulatorName(nextBootedSimulatorName);
        if (!selectedSource && nextSources.length > 0) {
          // Prefer the primary display over "whichever screen source
          // desktopCapturer happened to list first" -- see
          // CaptureSource.isPrimaryDisplay.
          const defaultSource =
            nextSources.find((s) => s.type === 'screen' && s.isPrimaryDisplay) ?? nextSources[0];
          setSelectedSource(defaultSource);
        }
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchSources();
  }, [fetchSources]);

  const refresh = useCallback(() => {
    setLoading(true);
    fetchSources();
  }, [fetchSources]);

  return { sources, bootedSimulatorName, loading, error, refresh };
}
