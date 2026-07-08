import { useCallback, useState } from 'react';
import type { RecordingRequest, RecordingSession } from '@screen-studio/types/recording';

// TODO: wrap start/stop/pause IPC calls and expose elapsed time, audio level
// meter, etc. for the record-setup and recording-hud pages.
export function useRecordingSession(): {
  session: RecordingSession | null;
  start: (request: RecordingRequest) => Promise<void>;
  stop: () => Promise<void>;
} {
  const [session, setSession] = useState<RecordingSession | null>(null);

  const start = useCallback(async (request: RecordingRequest) => {
    const next = await window.screenStudio.recording.start(request);
    setSession(next);
  }, []);

  const stop = useCallback(async () => {
    await window.screenStudio.recording.stop();
    setSession(null);
  }, []);

  return { session, start, stop };
}
