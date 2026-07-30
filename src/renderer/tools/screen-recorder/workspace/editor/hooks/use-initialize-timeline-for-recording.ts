import { useEffect } from 'react';
import { resetHistory } from '../../../features/history/store/history-store';
import { useTimelineStore } from '../../../features/timeline/store/timeline-store';

interface UseInitializeTimelineForRecordingOptions {
  previewUrl: string | undefined;
  durationSec: number;
  initializeFromDuration: (durationMs: number) => void;
}

export function useInitializeTimelineForRecording({
  previewUrl,
  durationSec,
  initializeFromDuration
}: UseInitializeTimelineForRecordingOptions): void {
  useEffect(() => {
    if (previewUrl && durationSec > 0) {
      if (useTimelineStore.getState().skipNextAutoInit) {
        useTimelineStore.setState({ skipNextAutoInit: false });
      } else {
        initializeFromDuration(durationSec * 1000);
      }
      resetHistory();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewUrl, durationSec]);
}
