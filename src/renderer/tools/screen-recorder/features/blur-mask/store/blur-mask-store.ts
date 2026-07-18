import { create } from 'zustand';
import type { BlurMaskRegion } from '@screen-recorder/types/project';
import type { CropRect } from '@screen-recorder/types/timeline';
import { withHistory } from '../../history/lib/with-history';

export const DEFAULT_BLUR_MASK_DURATION_MS = 3000;
export const DEFAULT_BLUR_INTENSITY = 12;
export const MIN_BLUR_INTENSITY = 1;
export const MAX_BLUR_INTENSITY = 20;
export const DEFAULT_MASK_COLOR = '#000000';
// Roughly centered, big enough to be immediately visible/grabbable once added.
const DEFAULT_RECT: CropRect = { x: 0.32, y: 0.4, width: 0.36, height: 0.2 };

type BlurMaskPatch = Partial<Omit<BlurMaskRegion, 'id' | 'kind'>>;

interface BlurMaskStoreState {
  regions: BlurMaskRegion[];
  /**
   * Which region is focused -- set by clicking its pill in BlurMaskTrack
   * (which renders independently of the panel, in CutTimeline), a card in
   * BlurMaskPanel, or clicking/dragging it directly on the preview stage,
   * same pattern as `annotations-store`'s `selectedAnnotationId`.
   */
  selectedRegionId: string | null;
  addBlurRegion: (atMs: number) => string;
  addMaskRegion: (atMs: number) => string;
  removeRegion: (id: string) => void;
  updateRegion: (id: string, patch: BlurMaskPatch) => void;
  setSelectedRegionId: (id: string | null) => void;
}

export const useBlurMaskStore = create<BlurMaskStoreState>(
  withHistory(
    'blur-mask',
    (s) => ({ regions: s.regions }),
    (set) => ({
      regions: [],
      selectedRegionId: null,

      addBlurRegion: (atMs) => {
        const id = crypto.randomUUID();
        const region: BlurMaskRegion = {
          id,
          kind: 'blur',
          atMs,
          durationMs: DEFAULT_BLUR_MASK_DURATION_MS,
          shape: 'rectangle',
          rect: { ...DEFAULT_RECT },
          intensity: DEFAULT_BLUR_INTENSITY,
          color: DEFAULT_MASK_COLOR
        };
        set((state) => ({ regions: [...state.regions, region], selectedRegionId: id }));
        return id;
      },

      addMaskRegion: (atMs) => {
        const id = crypto.randomUUID();
        const region: BlurMaskRegion = {
          id,
          kind: 'mask',
          atMs,
          durationMs: DEFAULT_BLUR_MASK_DURATION_MS,
          shape: 'rectangle',
          rect: { ...DEFAULT_RECT },
          intensity: DEFAULT_BLUR_INTENSITY,
          color: DEFAULT_MASK_COLOR
        };
        set((state) => ({ regions: [...state.regions, region], selectedRegionId: id }));
        return id;
      },

      removeRegion: (id) =>
        set((state) => ({
          regions: state.regions.filter((r) => r.id !== id),
          selectedRegionId: state.selectedRegionId === id ? null : state.selectedRegionId
        })),

      updateRegion: (id, patch) =>
        set((state) => ({
          regions: state.regions.map((r) => (r.id === id ? { ...r, ...patch } : r))
        })),

      setSelectedRegionId: (selectedRegionId) => set({ selectedRegionId })
    })
  )
);
