import type { RecordingRequest, RecordingSession } from '@screen-recorder/types/recording';

// Orchestrates a recording session: video capture (via renderer-side
// getUserMedia/getDisplayMedia against the chosen source), mic/system audio
// muxing, and writing the raw capture to disk for the editor to load.
// TODO: implement the actual capture pipeline (likely MediaRecorder in the
// renderer streaming chunks to this process over IPC, or a native recorder
// for better performance on long recordings).
export class RecordingController {
  private session: RecordingSession | null = null;

  start(request: RecordingRequest): RecordingSession {
    this.session = {
      id: crypto.randomUUID(),
      state: 'recording',
      startedAt: Date.now(),
      request
    };
    return this.session;
  }

  stop(): void {
    // TODO: finalize the file on disk, then hand off to the editor/import pipeline
    this.session = null;
  }

  getSession(): RecordingSession | null {
    return this.session;
  }
}

export const recordingController = new RecordingController();
