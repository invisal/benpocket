import clickSoundUrl from './mouse-click.mp3';

/**
 * Bundled click-sound effect -- both the live preview (`use-click-sound.ts`)
 * and the export audio pipeline (`audio-encoder.ts`, a different feature,
 * hence the cross-feature import) decode this same file rather than each
 * shipping/synthesizing their own, so they always sound identical.
 */

let cachedBytes: Promise<ArrayBuffer> | null = null;

function loadClickSoundBytes(): Promise<ArrayBuffer> {
  return (cachedBytes ??= fetch(clickSoundUrl).then((response) => response.arrayBuffer()));
}

// Keyed by sample rate -- the live preview's hardware `AudioContext` rate and
// an export's own codec sample rate are usually different, and each is
// decoded (and reused) at most once regardless of how many clicks are played
// or mixed in during that session/export.
const decodedBurstCache = new Map<number, Promise<Float32Array>>();

/**
 * Decodes the bundled click-sound asset into mono float32 PCM at
 * `sampleRate` -- `decodeAudioData` resamples to whatever context it's
 * called through, so calling this with different rates naturally produces
 * correctly-resampled burst data for each. Uses an `OfflineAudioContext`
 * purely for its `decodeAudioData` (inherited from `BaseAudioContext`) --
 * nothing is ever rendered/played through it.
 */
export function decodeClickSoundBurst(sampleRate: number): Promise<Float32Array> {
  const cached = decodedBurstCache.get(sampleRate);
  if (cached) return cached;

  const promise = loadClickSoundBytes().then(async (bytes) => {
    // `decodeAudioData` detaches the buffer it's given -- `.slice(0)` gives
    // it a disposable copy so `cachedBytes`' own buffer survives reuse.
    const offlineContext = new OfflineAudioContext(1, 1, sampleRate);
    const audioBuffer = await offlineContext.decodeAudioData(bytes.slice(0));
    return audioBuffer.getChannelData(0);
  });
  decodedBurstCache.set(sampleRate, promise);
  return promise;
}
