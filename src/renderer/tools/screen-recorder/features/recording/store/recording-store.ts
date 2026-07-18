import { create } from 'zustand';
import type { AudioInputOptions, CaptureSource } from '@screen-recorder/types/recording';
import type { CaptureRegionSelection } from '@shared/capture-region';

function stopStream(stream: MediaStream | null): void {
  stream?.getTracks().forEach((track) => track.stop());
}

interface RecordingStoreState {
  selectedSource: CaptureSource | null;
  /**
   * Set when the pick came from the native OS picker (getDisplayMedia)
   * instead of desktopCapturer.getSources() -- the live stream itself IS
   * the pick, there's no chromeMediaSourceId to re-request it by later, so
   * capture-engine.ts reuses this stream directly at recording start
   * instead of opening a fresh one. Owned by the store (and stopped here)
   * only until a recording actually claims it -- see takeNativePickerStream.
   */
  nativePickerStream: MediaStream | null;
  /**
   * Drag-selected sub-rectangle of `selectedSource` ("Area" mode, set via
   * the focus toolbar) -- see capture-engine.ts's live crop relay. Tied to
   * whichever source it was measured against, so any new pick clears it.
   */
  cropRegion: CaptureRegionSelection | null;
  audio: AudioInputOptions;
  setSelectedSource: (source: CaptureSource | null) => void;
  /** Adopts a native-picker stream as the current pick, releasing any previous one. */
  setNativePickerSelection: (stream: MediaStream, source: CaptureSource) => void;
  /**
   * Hands ownership of the current native-picker stream to the caller
   * (clearing it from the store WITHOUT stopping its tracks) -- for
   * useRecordingController.start() to fold into the active capture. Once
   * taken, an unrelated setSelectedSource click during that recording can
   * no longer reach in and stop the stream out from under it.
   */
  takeNativePickerStream: () => MediaStream | null;
  setCropRegion: (region: CaptureRegionSelection | null) => void;
  setAudio: (audio: Partial<AudioInputOptions>) => void;
}

export const useRecordingStore = create<RecordingStoreState>((set, get) => ({
  selectedSource: null,
  nativePickerStream: null,
  cropRegion: null,
  audio: { microphoneEnabled: true, systemAudioEnabled: false },
  setSelectedSource: (selectedSource) => {
    stopStream(get().nativePickerStream);
    set({ selectedSource, nativePickerStream: null, cropRegion: null });
  },
  setNativePickerSelection: (stream, selectedSource) => {
    stopStream(get().nativePickerStream);
    set({ selectedSource, nativePickerStream: stream, cropRegion: null });
  },
  takeNativePickerStream: () => {
    const stream = get().nativePickerStream;
    set({ nativePickerStream: null });
    return stream;
  },
  setCropRegion: (cropRegion) => set({ cropRegion }),
  setAudio: (audio) => set((state) => ({ audio: { ...state.audio, ...audio } }))
}));
