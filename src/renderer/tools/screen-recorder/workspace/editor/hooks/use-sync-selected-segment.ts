import { useEffect } from 'react';
import type { TimelineSegment } from '@screen-recorder/types/timeline';

interface UseSyncSelectedSegmentOptions {
  segments: TimelineSegment[];
  selectedSegmentId: string | null;
  setSelectedSegmentId: (id: string | null) => void;
}

export function useSyncSelectedSegment({
  segments,
  selectedSegmentId,
  setSelectedSegmentId
}: UseSyncSelectedSegmentOptions): void {
  useEffect(() => {
    if (segments.length === 0) {
      if (selectedSegmentId !== null) setSelectedSegmentId(null);
    } else if (!segments.some((s) => s.id === selectedSegmentId)) {
      setSelectedSegmentId(segments[0].id);
    }
  }, [segments, selectedSegmentId, setSelectedSegmentId]);
}
