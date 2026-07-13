import { create } from 'zustand';
import type { BackgroundSettings } from '@screen-recorder/types/project';
import { WALLPAPER_PRESETS } from '@shared/wallpaper-presets';

interface BackgroundStoreState extends BackgroundSettings {
  setKind: (kind: BackgroundSettings['kind']) => void;
  setValue: (value: string) => void;
  setPadding: (padding: number) => void;
  setBlur: (blur: number) => void;
  setCornerRadius: (cornerRadius: number) => void;
  setShadow: (shadow: number) => void;
}

export const useBackgroundStore = create<BackgroundStoreState>((set) => ({
  kind: 'wallpaper',
  value: WALLPAPER_PRESETS[0].id,
  padding: 2,
  blur: 0,
  cornerRadius: 12,
  shadow: 40,
  setKind: (kind) => set({ kind }),
  setValue: (value) => set({ value }),
  setPadding: (padding) => set({ padding }),
  setBlur: (blur) => set({ blur }),
  setCornerRadius: (cornerRadius) => set({ cornerRadius }),
  setShadow: (shadow) => set({ shadow })
}));
