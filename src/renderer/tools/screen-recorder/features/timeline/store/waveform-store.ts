import { create } from 'zustand';
import { decodeWaveformPeaks } from '../lib/decode-waveform-peaks';

/** Enough resolution to look detailed at full timeline width without the SVG path getting huge. */
const PEAK_COUNT = 1200;

interface WaveformStoreState {
  peaks: Float32Array | null;
  /** Which recording `peaks` belongs to -- lets `loadForUrl` no-op on re-renders and ignore a stale decode that resolves after a newer recording has already started loading. */
  sourceUrl: string | null;
  status: 'idle' | 'loading' | 'ready' | 'error';
  loadForUrl: (url: string) => void;
}

export const useWaveformStore = create<WaveformStoreState>((set, get) => ({
  peaks: null,
  sourceUrl: null,
  status: 'idle',

  loadForUrl: (url) => {
    const current = get();
    if (current.sourceUrl === url && current.status !== 'error') return;
    set({ sourceUrl: url, status: 'loading', peaks: null });

    decodeWaveformPeaks(url, PEAK_COUNT)
      .then((peaks) => {
        if (get().sourceUrl !== url) return;
        set({ peaks, status: 'ready' });
      })
      .catch((err) => {
        console.error('[waveform-store] failed to decode audio peaks:', err);
        if (get().sourceUrl !== url) return;
        set({ status: 'error' });
      });
  }
}));
