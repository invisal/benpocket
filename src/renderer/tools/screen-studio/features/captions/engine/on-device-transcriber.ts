export interface TranscriptSegment {
  startMs: number;
  endMs: number;
  text: string;
}

// TODO: run a local, offline speech-to-text model (e.g. a bundled
// whisper.cpp binary or a native/WASM module) over the recording's audio
// track. Must never upload audio anywhere - fully on-device, works offline.
export interface OnDeviceTranscriber {
  isModelReady(): Promise<boolean>;
  transcribe(audioFilePath: string): Promise<TranscriptSegment[]>;
}

export function createOnDeviceTranscriber(): OnDeviceTranscriber {
  return {
    isModelReady: async () => false,
    transcribe: async () => {
      throw new Error('On-device transcription model not yet bundled');
    }
  };
}
