import { useEffect, useMemo, useState, type JSX } from 'react';
import { AppWindow as WindowIcon, Monitor } from 'lucide-react';
import type { CaptureSource } from '@screen-recorder/types/recording';
import type { SourcePickerOverlayInit } from '@shared/source-picker-overlay';

function parseInit(): SourcePickerOverlayInit | null {
  try {
    const raw = new URLSearchParams(window.location.search).get('options');
    return raw ? (JSON.parse(raw) as SourcePickerOverlayInit) : null;
  } catch {
    return null;
  }
}

/**
 * Single-display click-to-record overlay opened from the focus toolbar's
 * Display/Window tabs (see main/screen-recorder/windows/
 * source-picker-overlay-window.ts) -- scoped to whichever display the
 * cursor was on when it opened (init.targetDisplayId). Clicking a
 * panel/card both picks that source and starts recording it immediately --
 * there's no separate "confirm" step, matching how the native macOS
 * recorder's window-select mode works.
 *
 * 'screen' gets one real panel, positioned exactly on the target display via
 * CaptureSource.displayBounds (always resolved for screens) -- filtered to
 * that one display rather than trusting every screen source's bounds to
 * land somewhere visible inside this now single-display-sized window.
 * 'window' sources have no resolvable on-screen position (desktopCapturer
 * doesn't expose one for arbitrary windows -- see the many other comments
 * on this across the codebase), so those fall back to a thumbnail grid
 * instead of a true per-window overlay -- unfiltered, since there's no way
 * to tell which display an arbitrary window is actually on.
 */
export function SourcePickerOverlayApp(): JSX.Element | null {
  const init = useMemo(() => parseInit(), []);
  const [sources, setSources] = useState<CaptureSource[]>([]);

  useEffect(() => {
    window.screenRecorder.recording
      .getCaptureSources()
      .then(setSources)
      .catch(() => setSources([]));
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') window.screenRecorder.sourcePickerOverlay.cancel();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  if (!init) return null;

  function pick(source: CaptureSource): void {
    window.screenRecorder.sourcePickerOverlay.pick(source.id);
  }

  const matching = sources.filter(
    (s) => s.type === init.type && (s.type !== 'screen' || s.displayId === init.targetDisplayId)
  );

  return (
    <div
      className="relative h-screen w-screen"
      onClick={() => window.screenRecorder.sourcePickerOverlay.cancel()}
    >
      {init.type === 'screen' ? (
        matching.map(
          (source) =>
            source.displayBounds && (
              <button
                key={source.id}
                onClick={(event) => {
                  event.stopPropagation();
                  pick(source);
                }}
                className="group absolute flex items-center justify-center border-2 border-transparent bg-black/35 transition-colors hover:border-accent hover:bg-black/60"
                style={{
                  left: source.displayBounds.x - init.origin.x,
                  top: source.displayBounds.y - init.origin.y,
                  width: source.displayBounds.width,
                  height: source.displayBounds.height
                }}
              >
                <span className="flex items-center gap-3 rounded-2xl bg-black/70 px-8 py-4 text-2xl font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
                  <Monitor size={28} />
                  Start Recording
                </span>
              </button>
            )
        )
      ) : (
        <div
          className="flex h-full w-full items-center justify-center"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="grid max-h-[80vh] max-w-[80vw] grid-cols-4 gap-4 overflow-auto p-4">
            {matching.map((source) => (
              <button
                key={source.id}
                onClick={() => pick(source)}
                title={source.name}
                className="group relative overflow-hidden rounded-xl border border-white/10 bg-zinc-900 text-left"
              >
                <img
                  src={source.thumbnailDataUrl}
                  alt={source.name}
                  className="aspect-video w-full object-cover opacity-80 transition-opacity group-hover:opacity-30"
                />
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                  <WindowIcon size={22} className="text-white" />
                  <span className="text-sm font-medium text-white">Start Recording</span>
                </div>
                <p className="truncate px-2 py-1.5 text-[11px] text-white/70">{source.name}</p>
              </button>
            ))}
            {matching.length === 0 && (
              <p className="col-span-4 text-center text-sm text-white/50">No windows available.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
