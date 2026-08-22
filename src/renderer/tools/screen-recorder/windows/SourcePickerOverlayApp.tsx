import { useEffect, useMemo, useRef, useState, type JSX } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Loader2 } from 'lucide-react';
import { cn } from 'cnfast';
import { Button } from '@renderer/components/ui/Button';
import type { CaptureSource } from '@screen-recorder/types/recording';
import type { SourcePickerOverlayInit } from '@shared/source-picker-overlay';

// The Start Recording button (and Enter, its keyboard equivalent -- see
// targetSource below) always gets a visible countdown, even when the
// toolbar's own countdown setting is 0 ("off") -- that setting only governs
// the display/window card click-to-record flow below, which is meant to
// feel instant. Clicking a card also still passes through the toolbar's
// configured countdownSeconds as-is.
const START_BUTTON_COUNTDOWN_SECONDS = 3;

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
 * panel/card (or Enter, or the Start Recording button, for the
 * auto-resolved single-source case -- see targetSource) confirms it
 * immediately: runs the countdown (if configured) right here, then calls
 * `recorderToolbar.requestStart` directly -- the exact same call the
 * toolbar's own Record button makes,
 * see RecorderToolbarApp.tsx's beginRecording -- with the audio/webcam/
 * cursor settings the toolbar handed over when it opened this overlay
 * (init.audio/webcam/cursorSettings). This overlay stays open showing a
 * "Starting…" state until that settles (onRecordingResult, relayed by
 * source-picker-overlay-window.ts only while this window is open), then
 * closes itself either way -- the toolbar picks up the same result on its
 * own and is already showing the right state by the time it's un-hidden.
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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [countdownRemaining, setCountdownRemaining] = useState<number | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasConfirmedRef = useRef(false);

  useEffect(() => {
    window.screenRecorder.recording
      .getCaptureSources()
      .then(setSources)
      .catch(() => setSources([]));
  }, []);

  // Whichever result comes back, this overlay's job is done -- close it (and
  // restore the toolbar) either way. The toolbar's own onRecordingResult
  // listener reacts to the same relay independently and already shows the
  // right 'recording' state or setup+error state underneath by the time it
  // becomes visible again.
  useEffect(
    () =>
      window.screenRecorder.recorderToolbar.onRecordingResult(() => {
        window.screenRecorder.sourcePickerOverlay.cancel();
      }),
    []
  );

  // Computed unconditionally (not after the `!init` guard below) so the
  // keydown effect -- which must run on every render regardless of `init`,
  // per the rules of hooks -- can read it.
  const matching = init
    ? sources.filter(
        (s) => s.type === init.type && (s.type !== 'screen' || s.displayId === init.targetDisplayId)
      )
    : [];
  // The unambiguous target for Enter/the Start button: whatever's explicitly
  // selected, or the sole match when nothing's been clicked yet (screen mode
  // only ever has one card; window mode only auto-targets when there's
  // exactly one thumbnail, never guessing among several).
  const targetSource =
    matching.find((s) => s.id === selectedId) ?? (matching.length === 1 ? matching[0] : null);

  function cancelCountdown(): void {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    setCountdownRemaining(null);
    hasConfirmedRef.current = false;
  }

  // Same call the toolbar's own Record button makes (beginRecording in
  // RecorderToolbarApp.tsx) -- targetBounds/cropRegion follow that same
  // pattern (a plain source pick here never has a crop region; Area
  // selection is toolbar-only). Takes `init` as a parameter (rather than
  // reading the outer one directly) purely so TypeScript can see it's
  // non-null here -- its control-flow narrowing doesn't cross function
  // boundaries, and confirmSelection below already guarantees this can
  // never actually run with a null init.
  function startRecording(init: SourcePickerOverlayInit, source: CaptureSource): void {
    setIsStarting(true);
    window.screenRecorder.recorderToolbar.requestStart({
      source,
      audio: init.audio,
      webcam: init.webcam,
      targetBounds: source.displayBounds,
      cursorSettings: init.cursorSettings,
      countdownSeconds: init.countdownSeconds
    });
  }

  // Only ever called once `init` is confirmed non-null in practice -- from
  // JSX gated by the guard below, or the keydown handler's `targetSource`
  // check, which is itself derived from `init`. `countdownSecondsOverride`
  // lets the Start Recording button (and Enter) force a visible countdown
  // even when the toolbar's own setting is 0 -- see
  // START_BUTTON_COUNTDOWN_SECONDS above. Card clicks omit it and just get
  // whatever the toolbar has configured.
  function confirmSelection(source: CaptureSource, countdownSecondsOverride?: number): void {
    if (!init) return;
    if (hasConfirmedRef.current) return;
    hasConfirmedRef.current = true;
    const countdownSeconds = countdownSecondsOverride ?? init.countdownSeconds;
    if (countdownSeconds > 0) {
      let remaining = countdownSeconds;
      setCountdownRemaining(remaining);
      countdownIntervalRef.current = setInterval(() => {
        remaining -= 1;
        if (remaining <= 0) {
          if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
          setCountdownRemaining(null);
          startRecording(init, source);
          return;
        }
        setCountdownRemaining(remaining);
      }, 1000);
      return;
    }
    startRecording(init, source);
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      // Nothing left to cancel once the request is actually in flight --
      // same as the toolbar's own Record button disabling itself in 'starting' mode.
      if (isStarting) return;
      if (event.key === 'Escape') {
        // A running countdown gets cancelled on its own -- back to
        // selection, not all the way out of the overlay.
        if (countdownRemaining !== null) {
          cancelCountdown();
          return;
        }
        window.screenRecorder.sourcePickerOverlay.cancel();
        return;
      }
      if (event.key === 'Enter' && countdownRemaining === null && targetSource) {
        confirmSelection(targetSource, START_BUTTON_COUNTDOWN_SECONDS);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countdownRemaining, targetSource, isStarting]);

  if (!init) return null;

  return (
    <div
      className="relative h-screen w-screen"
      onClick={() => {
        if (isStarting) return;
        if (countdownRemaining !== null) {
          cancelCountdown();
          return;
        }
        window.screenRecorder.sourcePickerOverlay.cancel();
      }}
    >
      {init.type === 'screen' ? (
        matching.map(
          (source) =>
            source.displayBounds && (
              <button
                key={source.id}
                onClick={(event) => {
                  event.stopPropagation();
                  setSelectedId(source.id);
                  confirmSelection(source);
                }}
                className={cn(
                  'group absolute flex items-center justify-center border-2 bg-black/35 transition-colors hover:border-accent hover:bg-black/60',
                  targetSource?.id === source.id
                    ? 'border-accent bg-black/60'
                    : 'border-transparent'
                )}
                style={{
                  left: source.displayBounds.x - init.origin.x,
                  top: source.displayBounds.y - init.origin.y,
                  width: source.displayBounds.width,
                  height: source.displayBounds.height
                }}
              ></button>
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
                onClick={() => {
                  setSelectedId(source.id);
                  confirmSelection(source);
                }}
                title={source.name}
                className={cn(
                  'group relative overflow-hidden rounded-xl border bg-zinc-900 text-left',
                  targetSource?.id === source.id ? 'border-accent' : 'border-white/10'
                )}
              >
                <img
                  src={source.thumbnailDataUrl}
                  alt={source.name}
                  className="aspect-video w-full object-cover opacity-80 transition-opacity group-hover:opacity-30"
                />
                <p className="truncate px-2 py-1.5 text-[11px] text-white/70">{source.name}</p>
              </button>
            ))}
            {matching.length === 0 && (
              <p className="col-span-4 text-center text-white/50">No windows available.</p>
            )}
          </div>
        </div>
      )}

      {/* pointer-events-none on the wrapper so its `inset-0` footprint
          doesn't block clicks through to the display panel/thumbnail grid
          underneath everywhere except the button itself. Screen mode only --
          in window mode this would sit dead-center over the thumbnail grid,
          covering whichever window it's meant to be labeling. Window mode
          doesn't need it anyway: clicking a thumbnail already confirms
          immediately (see the grid above), Start Recording isn't a separate
          step there. Hidden once the countdown/starting overlay below takes
          over -- that overlay's backdrop is translucent (bg-black/70), so
          this would otherwise show through it. */}
      <div className="pointer-events-none fixed inset-0 flex flex-col items-center justify-center gap-6">
        {init.type === 'screen' && targetSource && countdownRemaining === null && !isStarting && (
          <>
            <div className="flex flex-col items-center gap-1 text-center">
              <h1 className="max-w-lg truncate text-2xl font-semibold text-white drop-shadow-sm">
                {targetSource.name}
              </h1>
              {targetSource.displayBounds && (
                <p className="text-white/60">
                  {Math.round(targetSource.displayBounds.width)}×
                  {Math.round(targetSource.displayBounds.height)}
                </p>
              )}
            </div>
            <Button
              size="lg"
              onClick={(event) => {
                event.stopPropagation();
                if (targetSource) confirmSelection(targetSource, START_BUTTON_COUNTDOWN_SECONDS);
              }}
              disabled={!targetSource}
              className="pointer-events-auto gap-2 rounded-full shadow-2xl"
            >
              <span className="h-2.5 w-2.5 rounded-full bg-red-600" />
              Start Recording
            </Button>
          </>
        )}
      </div>

      {(countdownRemaining !== null || isStarting) && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-black/70">
          <AnimatePresence mode="popLayout">
            {isStarting ? (
              <motion.div
                key="starting"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center gap-3"
              >
                <Loader2 size={48} className="animate-spin text-white" />
                <span className="text-lg font-medium text-white">Starting…</span>
              </motion.div>
            ) : (
              <motion.span
                key={countdownRemaining}
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.4 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                className="font-mono text-8xl font-semibold text-white"
              >
                {countdownRemaining}
              </motion.span>
            )}
          </AnimatePresence>
          {!isStarting && (
            <Button
              variant="ghost"
              onClick={(event) => {
                event.stopPropagation();
                cancelCountdown();
              }}
              className="text-white/60 hover:bg-white/10 hover:text-white"
            >
              Cancel
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
