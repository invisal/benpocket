import { useEffect, useRef } from 'react';
import type { CursorPathPoint } from '@screen-recorder/types/project';
import { clickElapsedSecondsInRange, intensityToGain, scaleBurst } from '@shared/click-sound';
import { decodeClickSoundBurst } from './click-sound-asset';

/**
 * A single forward step across more than this many ms is treated as a
 * scrub/seek jump (e.g. clicking a new timeline position) rather than
 * ordinary playback advancing -- every click skipped over in a jump like
 * that shouldn't all play at once. Comfortably above normal `timeupdate`
 * cadence (well under 250ms even at low frame rates) but well below a
 * deliberate seek.
 */
const MAX_FORWARD_JUMP_MS = 400;

/**
 * Plays the bundled click-sound asset (see `click-sound-asset.ts`) each time
 * playback crosses a recorded mousedown -- the live-preview half of the
 * click-sound feature; `audio-encoder.ts` mixes the same decoded waveform
 * into the exported audio track. Only forward progress within
 * `MAX_FORWARD_JUMP_MS` counts as "crossing" a click, so scrubbing/seeking
 * past a run of clicks doesn't fire them all at once, and rewinding never
 * replays them.
 */
export function useClickSound(
  clickPath: CursorPathPoint[],
  currentTimeMs: number,
  enabled: boolean,
  intensity: number
): void {
  const audioContextRef = useRef<AudioContext | null>(null);
  const previousTimeMsRef = useRef(currentTimeMs);

  useEffect(() => {
    const previousTimeMs = previousTimeMsRef.current;
    previousTimeMsRef.current = currentTimeMs;
    if (!enabled || intensity <= 0) return;

    const jumpMs = currentTimeMs - previousTimeMs;
    if (jumpMs <= 0 || jumpMs > MAX_FORWARD_JUMP_MS) return;

    const crossedClicks = clickElapsedSecondsInRange(clickPath, previousTimeMs, currentTimeMs);
    if (crossedClicks.length === 0) return;

    const audioContext = (audioContextRef.current ??= new AudioContext());
    if (audioContext.state === 'suspended') void audioContext.resume();

    void decodeClickSoundBurst(audioContext.sampleRate).then((rawBurst) => {
      if (audioContext.state === 'closed') return;
      // `new Float32Array(burst)` (not the raw scaled result) --
      // `copyToChannel` requires an ArrayBuffer-backed view, and TS can't
      // otherwise rule out the scaled array being backed by a
      // SharedArrayBuffer.
      const burst = new Float32Array(scaleBurst(rawBurst, intensityToGain(intensity)));
      const buffer = audioContext.createBuffer(1, burst.length, audioContext.sampleRate);
      buffer.copyToChannel(burst, 0);

      // One `AudioBufferSourceNode` per crossed click -- each is single-use
      // by spec (can't call `.start()` twice), and overlapping clicks (two
      // very close together in a fast jump) should still both be audible
      // rather than one cutting the other off.
      for (let i = 0; i < crossedClicks.length; i++) {
        const source = audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(audioContext.destination);
        source.start();
      }
    });
  }, [clickPath, currentTimeMs, enabled, intensity]);

  useEffect(
    () => () => {
      void audioContextRef.current?.close();
    },
    []
  );
}
