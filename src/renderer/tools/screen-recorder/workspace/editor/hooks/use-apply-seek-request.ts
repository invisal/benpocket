import { useEffect, type RefObject } from 'react';
import type { PreviewVideoController } from '@screen-recorder/types/editor';

interface UseApplySeekRequestOptions {
  videoRef: RefObject<PreviewVideoController | null>;
  seekRequestMs: number | null;
  clearSeekRequest: () => void;
}

export function useApplySeekRequest({
  videoRef,
  seekRequestMs,
  clearSeekRequest
}: UseApplySeekRequestOptions): void {
  useEffect(() => {
    if (seekRequestMs === null) return;
    const video = videoRef.current;
    if (video) video.currentTime = seekRequestMs / 1000;
    clearSeekRequest();
  }, [seekRequestMs, clearSeekRequest, videoRef]);
}
