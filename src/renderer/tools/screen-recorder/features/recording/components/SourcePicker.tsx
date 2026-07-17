import type { JSX } from 'react';
import { useEffect, useState } from 'react';
import { Monitor, RefreshCw, Smartphone } from 'lucide-react';
import type { CaptureTargetType } from '@screen-recorder/types/recording';
import { useCaptureSources } from '../hooks/useCaptureSources';
import { useRecordingStore } from '../store/recording-store';
import { openRecorderToolbarFor } from '../lib/open-recorder-toolbar';

/** Chrome's Screen Capture API adds this to MediaTrackSettings; lib.dom doesn't have it yet. */
interface DisplaySurfaceSettings extends MediaTrackSettings {
  displaySurface?: 'monitor' | 'window' | 'browser' | 'application';
}

export function SourcePicker(): JSX.Element {
  const { sources, bootedSimulatorName, loading, error, refresh } = useCaptureSources();
  const selectedSource = useRecordingStore((state) => state.selectedSource);
  const setSelectedSource = useRecordingStore((state) => state.setSelectedSource);
  const [systemPickerSupported, setSystemPickerSupported] = useState(false);
  const [systemPickerError, setSystemPickerError] = useState<string | null>(null);

  useEffect(() => {
    window.screenRecorder.recording
      .supportsNativeSystemPicker()
      .then(setSystemPickerSupported)
      .catch(() => setSystemPickerSupported(false));
  }, []);

  // macOS 15+ only (gated by supportsNativeSystemPicker/registerDisplayMediaHandler).
  // Hands source selection to the real ScreenCaptureKit dialog instead of our
  // grid -- but the resulting stream has no chromeMediaSourceId to re-request
  // later, so it's kept alive and reused as-is at recording start (see
  // recording-store's nativePickerStream / capture-engine's
  // existingVideoStream), and doesn't get cursor tracking or the
  // recorder-toolbar flow, neither of which can key off an id that doesn't
  // exist.
  async function useSystemPicker(): Promise<void> {
    setSystemPickerError(null);
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      const settings = stream.getVideoTracks()[0]?.getSettings() as
        DisplaySurfaceSettings | undefined;
      const type: CaptureTargetType = settings?.displaySurface === 'monitor' ? 'screen' : 'window';
      useRecordingStore.getState().setNativePickerSelection(stream, {
        id: 'native-picker',
        name: stream.getVideoTracks()[0]?.label || 'System Picker Selection',
        type,
        thumbnailDataUrl: ''
      });
    } catch (err) {
      // User dismissed the native dialog -- not an error worth surfacing.
      if (err instanceof DOMException && err.name === 'NotAllowedError') return;
      setSystemPickerError(err instanceof Error ? err.message : String(err));
    }
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
        <div className="flex items-center gap-1">
          {systemPickerSupported && (
            <button
              onClick={useSystemPicker}
              title="Choose a screen or window from the native macOS picker"
              className="flex items-center gap-1 rounded px-1.5 py-1 text-[10px] text-white/40 hover:bg-white/10 hover:text-white/70"
            >
              <Monitor size={11} />
              Use System Picker
            </button>
          )}
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
      </div>

      {systemPickerError && (
        <p className="text-xs text-red-400">System picker failed: {systemPickerError}</p>
      )}

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
              onDoubleClick={() => void openRecorderToolbarFor(source)}
              title="Double-click to focus this source and record from a floating toolbar"
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
