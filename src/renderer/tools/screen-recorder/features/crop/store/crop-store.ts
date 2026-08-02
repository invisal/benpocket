import { create } from 'zustand';
import type { CropRect } from '@screen-recorder/types/timeline';
import { withHistory } from '../../history/lib/with-history';

interface CropStoreState {
  /** Single crop for the whole recording -- `null` means no crop, use the full frame. */
  rect: CropRect | null;
  setCrop: (rect: CropRect | null) => void;
}

export const useCropStore = create<CropStoreState>(
  withHistory(
    'crop',
    (s) => ({ rect: s.rect }),
    (set) => ({
      rect: null,
      setCrop: (rect) => set({ rect })
    })
  )
);
