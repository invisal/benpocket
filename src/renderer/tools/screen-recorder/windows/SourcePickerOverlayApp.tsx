import { useEffect, useMemo, useRef, useState, type JSX } from 'react';
import type { CaptureSource } from '@screen-recorder/types/recording';
import type { SourcePickerOverlayInit } from '@shared/source-picker-overlay';
import { SourcePickerScreenMode } from '../components/SourcePickerScreenMode';
import { SourcePickerWindowGrid } from '../components/SourcePickerWindowGrid';
import { SourcePickerCountdownOverlay } from '../components/SourcePickerCountdownOverlay';

// Card clicks feel instant even with countdown off; the Start button/Enter always gets a visible countdown.
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
 * Single-display click-to-record overlay opened from the toolbar's
 * Display/Window tabs, scoped to whichever display the cursor was on
 * (init.targetDisplayId). Confirming calls `recorderToolbar.requestStart`
 * directly (same as the toolbar's own Record button) and closes once
 * `onRecordingResult` settles.
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

  // The toolbar's own listener reacts to the same relay independently, so this overlay just closes either way.
  useEffect(
    () =>
      window.screenRecorder.recorderToolbar.onRecordingResult(() => {
        window.screenRecorder.sourcePickerOverlay.cancel();
      }),
    []
  );

  // Computed before the `!init` guard below so the keydown effect (which must run every render) can read it.
  const matching = init
    ? sources.filter(
        (s) => s.type === init.type && (s.type !== 'screen' || s.displayId === init.targetDisplayId)
      )
    : [];
  // Screen mode only ever has one card; window mode only auto-targets when there's exactly one thumbnail.
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

  // `countdownSecondsOverride` lets the Start button/Enter force a visible countdown even when the toolbar's setting is 0.
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

  function handleSelect(source: CaptureSource): void {
    setSelectedId(source.id);
    confirmSelection(source);
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (isStarting) return;
      if (event.key === 'Escape') {
        // A running countdown just cancels back to selection, not the whole overlay.
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

  function handleBackdropClick(): void {
    if (isStarting) return;
    if (countdownRemaining !== null) {
      cancelCountdown();
      return;
    }
    window.screenRecorder.sourcePickerOverlay.cancel();
  }

  return (
    <div className="relative h-screen w-screen" onClick={handleBackdropClick}>
      {init.type === 'screen' ? (
        <SourcePickerScreenMode
          matching={matching}
          targetSource={targetSource}
          origin={init.origin}
          onSelect={handleSelect}
          onStartClick={() => {
            if (targetSource) confirmSelection(targetSource, START_BUTTON_COUNTDOWN_SECONDS);
          }}
          showHud={countdownRemaining === null && !isStarting}
        />
      ) : (
        <SourcePickerWindowGrid
          sources={matching}
          targetSource={targetSource}
          onSelect={handleSelect}
        />
      )}

      <SourcePickerCountdownOverlay
        countdownRemaining={countdownRemaining}
        isStarting={isStarting}
        onCancel={cancelCountdown}
      />
    </div>
  );
}
