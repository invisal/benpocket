import type { CSSProperties } from 'react';
import type { BackgroundSettings } from '@screen-recorder/types/project';
import { findWallpaperPreset } from '@shared/wallpaper-presets';
import { wallpaperCssLayerStyle } from './wave-wallpaper';
import { findWallpaperImagePreset } from './wallpaper-images';

/** Renderer-side equivalent of main/export/frame-compositor.ts's drawBackground, for the live preview. */
export function backgroundLayerStyle(background: BackgroundSettings): CSSProperties {
  switch (background.kind) {
    case 'color':
      return { background: background.value };
    case 'gradient': {
      const [angleDeg = '135', color1 = '#000000', color2 = '#000000'] =
        background.value.split('|');
      return { background: `linear-gradient(${angleDeg}deg, ${color1}, ${color2})` };
    }
    case 'wallpaper': {
      const imagePreset = findWallpaperImagePreset(background.value);
      if (imagePreset) {
        return {
          backgroundImage: `url(${imagePreset.src})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        };
      }
      return wallpaperCssLayerStyle(findWallpaperPreset(background.value));
    }
    case 'image':
      return background.value
        ? {
            backgroundImage: `url(${background.value})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center'
          }
        : { background: '#000000' };
    default:
      return { background: '#000000' };
  }
}
