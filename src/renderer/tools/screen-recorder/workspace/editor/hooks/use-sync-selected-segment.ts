import { useEffect } from 'react';
import type { TimelineSegment } from '@screen-recorder/types/timeline';

interface UseSyncSelectedSegmentOptions {
  segments: TimelineSegment[];
  selectedSegmentId: string | null;
  setSelectedSegmentId: (id: string | null) => void;
  /**
   * True while a zoom keyframe/annotation/blur-mask region is explicitly
   * selected instead (see selection-coordinator.ts, which clears
   * `selectedSegmentId` whenever one of those is selected) -- suppresses
   * the auto-select-first-segment fallback below, so that explicit pill
   * selection doesn't get immediately overridden back to the default clip
   * the moment `selectedSegmentId` becomes `null`.
   */
  hasOtherSelection: boolean;
}

export function useSyncSelectedSegment({
  segments,
  selectedSegmentId,
  setSelectedSegmentId,
  hasOtherSelection
}: UseSyncSelectedSegmentOptions): void {
  useEffect(() => {
    if (segments.length === 0) {
      if (selectedSegmentId !== null) setSelectedSegmentId(null);
    } else if (!hasOtherSelection && !segments.some((s) => s.id === selectedSegmentId)) {
      setSelectedSegmentId(segments[0].id);
    }
  }, [segments, selectedSegmentId, setSelectedSegmentId, hasOtherSelection]);
}
