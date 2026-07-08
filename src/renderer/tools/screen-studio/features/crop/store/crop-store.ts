import { create } from 'zustand';
import type { CropRect } from '@screen-studio/types/timeline';

/**
 * @deprecated Unused. Crop moved from a single global rect to a per-clip
 * `TimelineSegment.crop` field -- see `features/timeline/store/timeline-store.ts`'s
 * `setSegmentCrop` and `features/crop/components/CropOverlay.tsx`, which now
 * reads/writes the selected clip's crop directly instead of this store.
 * Left in place (rather than deleted) only because this workspace folder
 * doesn't allow file deletion from here; safe to remove by hand.
 */
export type CropAspectId = 'free' | '16:9' | '9:16' | '1:1' | '4:3';

interface CropStoreState {
  /** `null` means "no crop, use the full frame" -- the common case. */
  rect: CropRect | null;
  aspect: CropAspectId;
  setRect: (rect: CropRect | null) => void;
  setAspect: (aspect: CropAspectId) => void;
  reset: () => void;
}

export const useCropStore = create<CropStoreState>((set) => ({
  rect: null,
  aspect: 'free',
  setRect: (rect) => set({ rect }),
  setAspect: (aspect) => set({ aspect }),
  reset: () => set({ rect: null, aspect: 'free' })
}));
