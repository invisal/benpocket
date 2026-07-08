/**
 * Bundled gradient "wallpapers" for the recording background -- rendered
 * procedurally (CSS `linear-gradient` in the renderer, a matching canvas
 * gradient in `main/export/frame-compositor.ts`) rather than shipped as
 * image files, so there are no binary assets to bundle/license and the
 * renderer preview and the exported output are guaranteed to match exactly.
 *
 * `angleDeg` follows CSS gradient-angle convention (0 = bottom-to-top,
 * 90 = left-to-right, clockwise) so `cssGradient()` below can hand it
 * straight to a CSS `linear-gradient(...)` string; frame-compositor.ts
 * converts it to the canvas convention itself.
 */
export interface WallpaperPreset {
  id: string;
  label: string;
  angleDeg: number;
  colors: string[];
}

export const WALLPAPER_PRESETS: WallpaperPreset[] = [
  { id: 'sunrise', label: 'Sunrise', angleDeg: 135, colors: ['#f97316', '#fb7185', '#f59e0b'] },
  { id: 'coral', label: 'Coral', angleDeg: 135, colors: ['#fb923c', '#f43f5e', '#ec4899'] },
  { id: 'peach', label: 'Peach', angleDeg: 120, colors: ['#fda4af', '#fdba74', '#fde68a'] },
  { id: 'ocean', label: 'Ocean', angleDeg: 135, colors: ['#0ea5e9', '#22d3ee', '#0891b2'] },
  { id: 'mint', label: 'Mint', angleDeg: 135, colors: ['#34d399', '#22d3ee', '#3b82f6'] },
  { id: 'emerald', label: 'Emerald', angleDeg: 140, colors: ['#10b981', '#059669', '#0d9488'] },
  { id: 'dusk', label: 'Dusk', angleDeg: 135, colors: ['#fb923c', '#a855f7', '#6366f1'] },
  { id: 'sky', label: 'Sky', angleDeg: 135, colors: ['#38bdf8', '#818cf8', '#c084fc'] },
  { id: 'candy', label: 'Candy', angleDeg: 135, colors: ['#f472b6', '#c084fc', '#818cf8'] },
  { id: 'violet', label: 'Violet', angleDeg: 145, colors: ['#8b5cf6', '#6366f1', '#4338ca'] },
  { id: 'grape', label: 'Grape', angleDeg: 135, colors: ['#a855f7', '#7c3aed', '#4c1d95'] },
  { id: 'midnight', label: 'Midnight', angleDeg: 135, colors: ['#1e293b', '#334155', '#475569'] }
];

export function findWallpaperPreset(id: string | undefined): WallpaperPreset {
  return WALLPAPER_PRESETS.find((p) => p.id === id) ?? WALLPAPER_PRESETS[0];
}

/** CSS `background` value for rendering a preset in the renderer (thumbnails + live preview). */
export function cssGradient(preset: WallpaperPreset): string {
  return `linear-gradient(${preset.angleDeg}deg, ${preset.colors.join(', ')})`;
}
