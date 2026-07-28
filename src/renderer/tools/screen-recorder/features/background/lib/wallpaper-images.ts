import wp1 from '@renderer/assets/wallpapers/images/wp-1.jpg';
import wp2 from '@renderer/assets/wallpapers/images/wp-2.jpg';
import wp3 from '@renderer/assets/wallpapers/images/wp-3.jpg';
import wp4 from '@renderer/assets/wallpapers/images/wp-4.jpg';
import wp5 from '@renderer/assets/wallpapers/images/wp-5.jpg';
import wp6 from '@renderer/assets/wallpapers/images/wp-6.jpg';

/**
 * Bundled wallpaper backgrounds for the "Wallpaper" tab -- picking one sets
 * `kind: 'wallpaper'`, `value: <id>` (unlike the Image tab's photo presets,
 * which set `kind: 'image'` directly), so the tab UI stays on "Wallpaper".
 * Resolved to an actual image (not a procedural gradient) by
 * `background-css.ts` and `timeline-evaluator.ts` checking this list before
 * falling back to `@shared/wallpaper-presets`'s generated wave/gradient look.
 */
export interface WallpaperImagePreset {
  id: string;
  label: string;
  src: string;
}

export const WALLPAPER_IMAGE_PRESETS: WallpaperImagePreset[] = [
  { id: 'wp-1', label: 'Wallpaper 1', src: wp1 },
  { id: 'wp-2', label: 'Wallpaper 2', src: wp2 },
  { id: 'wp-3', label: 'Wallpaper 3', src: wp3 },
  { id: 'wp-4', label: 'Wallpaper 4', src: wp4 },
  { id: 'wp-5', label: 'Wallpaper 5', src: wp5 },
  { id: 'wp-6', label: 'Wallpaper 6', src: wp6 }
];

export function findWallpaperImagePreset(id: string | undefined): WallpaperImagePreset | undefined {
  return WALLPAPER_IMAGE_PRESETS.find((p) => p.id === id);
}
