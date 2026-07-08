import { create } from 'zustand';
import type { AudioInputOptions, CaptureSource } from '@screen-studio/types/recording';

interface RecordingStoreState {
  selectedSource: CaptureSource | null;
  audio: AudioInputOptions;
  setSelectedSource: (source: CaptureSource | null) => void;
  setAudio: (audio: Partial<AudioInputOptions>) => void;
}

export const useRecordingStore = create<RecordingStoreState>((set) => ({
  selectedSource: null,
  audio: { microphoneEnabled: true, systemAudioEnabled: false },
  setSelectedSource: (selectedSource) => set({ selectedSource }),
  setAudio: (audio) => set((state) => ({ audio: { ...state.audio, ...audio } }))
}));
