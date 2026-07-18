/**
 * Downsamples a recording's audio track into a fixed-length array of 0-1
 * amplitude peaks (max abs sample per bin) -- what `SegmentWaveform` slices
 * per-clip to draw. Decodes the *whole* file via the Web Audio API rather
 * than a streaming approach; screen recordings are short/medium-length
 * single-track audio, not hours of multitrack material, so this is cheap
 * enough to do once per recording and cache (see waveform-store.ts).
 */
export async function decodeWaveformPeaks(url: string, peakCount: number): Promise<Float32Array> {
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  const audioContext = new AudioContext();
  try {
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    return extractPeaks(audioBuffer, peakCount);
  } finally {
    // Only decoding, never playing -- close immediately rather than leaving
    // an idle context (and its audio-device handle) alive for the page's
    // remaining lifetime.
    void audioContext.close();
  }
}

function extractPeaks(audioBuffer: AudioBuffer, peakCount: number): Float32Array {
  // One channel is enough for a visual silhouette -- a stereo mix's left
  // channel reads the same as the average would at this resolution.
  const channelData = audioBuffer.getChannelData(0);
  const samplesPerPeak = Math.max(1, Math.floor(channelData.length / peakCount));
  const peaks = new Float32Array(peakCount);
  for (let i = 0; i < peakCount; i++) {
    const start = i * samplesPerPeak;
    const end = Math.min(channelData.length, start + samplesPerPeak);
    let max = 0;
    for (let j = start; j < end; j++) {
      const abs = Math.abs(channelData[j]);
      if (abs > max) max = abs;
    }
    peaks[i] = max;
  }
  return peaks;
}
