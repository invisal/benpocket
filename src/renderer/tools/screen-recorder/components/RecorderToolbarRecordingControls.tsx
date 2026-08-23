import { useEffect, useRef, useState, type JSX, type RefObject } from 'react';
import { Loader2, Pause, Play, RotateCcw, Square, Trash2 } from 'lucide-react';
import { cn } from 'cnfast';
import { Tooltip } from '@renderer/components/ui/Tooltip';
import type { Mode } from '../types/toolbar';
import { formatElapsed } from '../lib/format';
import { DRAG, disablePointerEvents, enablePointerEvents } from '../lib/pointer-events';
import { RecorderToolbarIconButton } from './RecorderToolbarIconButton';

/** The pill shown for an in-progress recording session -- covers 'recording', 'paused', 'restarting' and 'stopping', all of which keep this same control set mounted (only their busy/paused styling differs). */
export function RecorderToolbarRecordingControls({
  mode,
  recordingStartedAt,
  nativeActive,
  pillRef,
  onModeChange
}: {
  mode: Extract<Mode, 'recording' | 'paused' | 'restarting' | 'stopping'>;
  recordingStartedAt: number | null;
  nativeActive: boolean;
  pillRef: RefObject<HTMLDivElement | null>;
  onModeChange: (mode: Mode) => void;
}): JSX.Element {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [deleteArmed, setDeleteArmed] = useState(false);
  const pausedDurationRef = useRef(0);
  const pauseStartedAtRef = useRef<number | null>(null);
  const deleteArmTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Resets pause bookkeeping on every (re)start, including Restart, which keeps this component mounted rather than remounting it.
  useEffect(() => {
    pausedDurationRef.current = 0;
    pauseStartedAtRef.current = null;
  }, [recordingStartedAt]);

  useEffect(
    () => () => {
      if (deleteArmTimeoutRef.current) clearTimeout(deleteArmTimeoutRef.current);
    },
    []
  );

  // Freezes the displayed time outside 'recording'; pausedDurationRef keeps resume from jumping the elapsed time forward.
  useEffect(() => {
    if (mode !== 'recording' || recordingStartedAt === null) return;
    const id = setInterval(
      () =>
        setElapsedSeconds(
          Math.floor((Date.now() - recordingStartedAt - pausedDurationRef.current) / 1000)
        ),
      250
    );
    return () => clearInterval(id);
  }, [mode, recordingStartedAt]);

  function handleStop(): void {
    onModeChange('stopping');
    window.screenRecorder.recorderToolbar.requestStop();
  }

  // Fire-and-forget, no ack event wired up -- optimistic UI.
  function handlePause(): void {
    void window.screenRecorder.nativeRecording.pause();
    pauseStartedAtRef.current = Date.now();
    onModeChange('paused');
  }

  function handleResume(): void {
    void window.screenRecorder.nativeRecording.resume();
    if (pauseStartedAtRef.current !== null) {
      pausedDurationRef.current += Date.now() - pauseStartedAtRef.current;
      pauseStartedAtRef.current = null;
    }
    onModeChange('recording');
  }

  // No native "abort without finalizing" -- this is a real stop-then-start round trip.
  function handleRestart(): void {
    onModeChange('restarting');
    window.screenRecorder.recorderToolbar.requestRestart();
  }

  // Destructive/irreversible -- first click arms for 3s, second confirms.
  function handleDeleteClick(): void {
    if (!deleteArmed) {
      setDeleteArmed(true);
      deleteArmTimeoutRef.current = setTimeout(() => setDeleteArmed(false), 3000);
      return;
    }
    if (deleteArmTimeoutRef.current) clearTimeout(deleteArmTimeoutRef.current);
    setDeleteArmed(false);
    window.screenRecorder.recorderToolbar.requestDelete();
  }

  const isPaused = mode === 'paused';
  const busy = mode === 'stopping' || mode === 'restarting';

  return (
    <div className="relative flex h-full items-end justify-center pb-4">
      {/* Dead-space overlay: click-blocks the window's transparent area outside the pill. */}
      <div className="absolute inset-0" onMouseEnter={disablePointerEvents} />
      <div
        ref={pillRef}
        onMouseEnter={enablePointerEvents}
        className={cn(
          DRAG,
          'flex items-center gap-4 rounded-full border border-border bg-surface/95 px-5 py-3 shadow-[0_0_28px_rgba(0,0,0,0.3)] backdrop-blur'
        )}
      >
        <div className="flex items-center gap-2">
          <span
            className={cn('h-2.5 w-2.5 rounded-full bg-red-500', !isPaused && 'animate-pulse')}
          />
          <span className="font-mono text-foreground">{formatElapsed(elapsedSeconds)}</span>
        </div>

        <Tooltip.Provider delay={200} closeDelay={0}>
          <div className="flex items-center gap-3 border-l border-border pl-4">
            <RecorderToolbarIconButton
              icon={
                mode === 'stopping' ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Square size={13} fill="currentColor" />
                )
              }
              tooltip={mode === 'stopping' ? 'Finishing…' : 'Finish'}
              onClick={handleStop}
              disabled={busy}
            />

            {/* Only the native helper path supports pause/resume. */}
            {nativeActive && (
              <RecorderToolbarIconButton
                icon={isPaused ? <Play size={13} /> : <Pause size={13} />}
                tooltip={isPaused ? 'Resume' : 'Pause'}
                onClick={isPaused ? handleResume : handlePause}
                disabled={busy}
              />
            )}

            <RecorderToolbarIconButton
              icon={<RotateCcw size={13} />}
              tooltip={mode === 'restarting' ? 'Restarting…' : 'Restart'}
              onClick={handleRestart}
              disabled={busy}
            />

            <RecorderToolbarIconButton
              icon={<Trash2 size={13} />}
              tooltip={deleteArmed ? 'Confirm?' : 'Delete'}
              onClick={handleDeleteClick}
              disabled={busy}
              tone={deleteArmed ? 'danger' : 'default'}
            />
          </div>
        </Tooltip.Provider>
      </div>
    </div>
  );
}
