import type { JSX } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Smartphone } from 'lucide-react';
import type { CaptureSource } from '@screen-recorder/types/recording';
import { useRecordingStore } from '../store/recording-store';

// Should only be missing if the preload script failed to load -- see
// main/windows/main-window.ts's preload-error listener for the corresponding
// main-process log.
const PRELOAD_MISSING_ERROR =
  'Recording API unavailable (preload script did not load). Check the console.';

export function SourcePicker(): JSX.Element {
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
        if (!selectedSource && nextSources.length > 0) setSelectedSource(nextSources[0]);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchSources();
  }, [fetchSources]);

  function refresh(): void {
    setLoading(true);
    fetchSources();
  }

  if (error) {
    return <p className="text-xs text-red-400">{error}</p>;
  }

  // A device can be "Booted" (simctl's backend state) with no Simulator.app
  // window actually open -- e.g. the window was closed without shutting the
  // device down. desktopCapturer then has no window for it to list at all,
  // which otherwise looks identical to "cursor tracking silently failed".
  const simulatorWindowMissing =
    bootedSimulatorName !== null &&
    !sources.some((s) => s.type === 'window' && s.name.includes(bootedSimulatorName));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-white/40">
          Pick a source
        </span>
        <button
          onClick={refresh}
          disabled={loading}
          title="Refresh sources"
          className="flex items-center gap-1 rounded px-1.5 py-1 text-[10px] text-white/40 hover:bg-white/10 hover:text-white/70 disabled:opacity-40"
        >
          <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {simulatorWindowMissing && (
        <p className="rounded-md bg-amber-500/10 px-2 py-1.5 text-[11px] text-amber-300">
          {bootedSimulatorName} is booted, but its window isn&apos;t open, so there&apos;s nothing
          to record yet -- open the Simulator app so its window is visible, then hit Refresh.
        </p>
      )}

      <div className="grid grid-cols-4 gap-3">
        {sources.map((source) => {
          const isSimulatorWindow =
            source.type === 'window' &&
            bootedSimulatorName !== null &&
            source.name.includes(bootedSimulatorName);
          const tracksCursor = Boolean(source.displayBounds);
          return (
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
              <p className="mt-1 flex items-center gap-1 truncate text-xs">
                {isSimulatorWindow && <Smartphone size={11} className="shrink-0 text-white/40" />}
                {source.name}
              </p>
              {/* Cursor tracking needs resolved display bounds -- shown here
                  so a bad pick/pairing is obvious without needing devtools.
                  See screen-source-provider.ts. */}
              <p
                className={`mt-0.5 truncate text-[10px] ${
                  tracksCursor ? 'text-emerald-400/70' : 'text-white/30'
                }`}
              >
                {isSimulatorWindow
                  ? tracksCursor
                    ? 'iOS Simulator -- cursor tracking ok'
                    : 'iOS Simulator -- bounds unresolved!'
                  : source.type === 'window'
                    ? 'window -- no cursor tracking'
                    : tracksCursor
                      ? 'screen -- cursor tracking ok'
                      : 'screen -- bounds unresolved!'}
              </p>
            </button>
          );
        })}
      </div>

      {selectedSource && (
        <p className="text-[10px] text-white/30">
          Selected: {selectedSource.name} ({selectedSource.type}, bounds:{' '}
          {selectedSource.displayBounds ? JSON.stringify(selectedSource.displayBounds) : 'none'})
        </p>
      )}
    </div>
  );
}
