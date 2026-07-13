import type { JSX } from 'react';
import { Crop } from 'lucide-react';
import { useTimelineStore } from '../../timeline/store/timeline-store';
import { SegmentFlagTrack } from '../../timeline/components/SegmentFlagTrack';

/** Pill track for clips with a crop applied -- see SegmentFlagTrack.tsx. */
export function CropTrack(): JSX.Element | null {
  const setSegmentCrop = useTimelineStore((s) => s.setSegmentCrop);

  return (
    <SegmentFlagTrack
      hasFlag={(segment) => segment.crop !== null}
      getTitle={(segment) =>
        segment.crop
          ? `${Math.round(segment.crop.width * 100)}% × ${Math.round(segment.crop.height * 100)}% -- drag to reorder`
          : ''
      }
      colorClassName="border-sky-500/50 bg-sky-700/30 text-sky-100 hover:bg-sky-700/45"
      renderContent={(segment) =>
        segment.crop && (
          <>
            <Crop size={10} className="shrink-0" />
            <span className="truncate text-[10px] font-medium">
              {Math.round(segment.crop.width * 100)}%
            </span>
          </>
        )
      }
      onReset={(segment) => setSegmentCrop(segment.id, null)}
      resetTitle="Clear crop"
    />
  );
}
