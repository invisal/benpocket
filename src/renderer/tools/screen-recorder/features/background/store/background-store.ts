import { create } from 'zustand';
import type { BackgroundSettings } from '@screen-recorder/types/project';
import { withHistory } from '../../history/lib/with-history';
import { WALLPAPER_IMAGE_PRESETS } from '../lib/wallpaper-images';

interface BackgroundStoreState extends BackgroundSettings {
  toggleEnabled: () => void;
  setKind: (kind: BackgroundSettings['kind']) => void;
  setValue: (value: string) => void;
  setPadding: (padding: number) => void;
  setBlur: (blur: number) => void;
  setCornerRadius: (cornerRadius: number) => void;
  setShadow: (shadow: number) => void;
}

export const useBackgroundStore = create<BackgroundStoreState>(
  withHistory(
    'background',
    (s) => ({
      enabled: s.enabled,
      kind: s.kind,
      value: s.value,
      padding: s.padding,
      blur: s.blur,
      cornerRadius: s.cornerRadius,
      shadow: s.shadow
    }),
    (set) => ({
      enabled: true,
      kind: 'wallpaper',
      value: WALLPAPER_IMAGE_PRESETS[0].id,
      padding: 2,
      blur: 0,
      cornerRadius: 12,
      shadow: 40,
      toggleEnabled: () => set((state) => ({ enabled: !state.enabled })),
      setKind: (kind) => set({ kind }),
      setValue: (value) => set({ value }),
      setPadding: (padding) => set({ padding }),
      setBlur: (blur) => set({ blur }),
      setCornerRadius: (cornerRadius) => set({ cornerRadius }),
      setShadow: (shadow) => set({ shadow })
    })
  )
);
