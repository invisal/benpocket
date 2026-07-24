/**
 * Bundled "wallpapers" for the recording background -- rendered procedurally
 * (CSS in the renderer, a matching PixiJS fill in
 * `features/export/engine/rendering/effects/background.ts`) rather than
 * shipped as image files, so there are no binary assets to bundle/license
 * and the renderer preview and the exported output are guaranteed to match
 * exactly.
 *
 * Two flavors:
 * - 'linear': a simple multi-stop `linear-gradient`.
 * - 'wave': several soft, fading color blobs over a base color -- the
 *   flowing, out-of-focus look of macOS's own default wallpapers
 *   (Big Sur/Monterey/Sonoma), without reproducing Apple's actual
 *   copyrighted artwork.
 *
 * `angleDeg` follows CSS gradient-angle convention (0 = bottom-to-top,
 * 90 = left-to-right, clockwise) so `cssGradient()` below can hand it
 * straight to a CSS `linear-gradient(...)` string; the PixiJS effect
 * converts it to its own convention itself. Blob `xPct`/`yPct`/`radiusPct`
 * are all 0-100, normalized to the canvas's own width/height (so a blob
 * naturally renders as an ellipse on non-square canvases, matching how the
 * PixiJS radial gradient's local texture space stretches to fit).
 */
export interface LinearWallpaperPreset {
  type: 'linear';
  id: string;
  label: string;
  angleDeg: number;
  colors: string[];
}

export interface WaveWallpaperPreset {
  type: 'wave';
  id: string;
  label: string;
  backgroundColor: string;
  blobs: { xPct: number; yPct: number; radiusPct: number; color: string }[];
}

export type WallpaperPreset = LinearWallpaperPreset | WaveWallpaperPreset;

export const WAVE_PRESETS: WaveWallpaperPreset[] = [
  {
    type: 'wave',
    id: 'big-sur',
    label: 'Big Sur',
    backgroundColor: '#0a1a2f',
    blobs: [
      { xPct: 15, yPct: 20, radiusPct: 70, color: '#f97316' },
      { xPct: 80, yPct: 30, radiusPct: 65, color: '#0ea5e9' },
      { xPct: 50, yPct: 85, radiusPct: 75, color: '#0f766e' }
    ]
  },
  {
    type: 'wave',
    id: 'monterey',
    label: 'Monterey',
    backgroundColor: '#1a0b2e',
    blobs: [
      { xPct: 25, yPct: 25, radiusPct: 70, color: '#a855f7' },
      { xPct: 75, yPct: 40, radiusPct: 65, color: '#ec4899' },
      { xPct: 50, yPct: 90, radiusPct: 70, color: '#fb923c' }
    ]
  },
  {
    type: 'wave',
    id: 'sonoma',
    label: 'Sonoma',
    backgroundColor: '#071a2b',
    blobs: [
      { xPct: 20, yPct: 30, radiusPct: 65, color: '#22d3ee' },
      { xPct: 70, yPct: 20, radiusPct: 60, color: '#3b82f6' },
      { xPct: 55, yPct: 85, radiusPct: 70, color: '#0891b2' }
    ]
  },
  {
    type: 'wave',
    id: 'aurora',
    label: 'Aurora',
    backgroundColor: '#04121a',
    blobs: [
      { xPct: 30, yPct: 15, radiusPct: 70, color: '#34d399' },
      { xPct: 70, yPct: 25, radiusPct: 65, color: '#818cf8' },
      { xPct: 50, yPct: 90, radiusPct: 75, color: '#4c1d95' }
    ]
  },
  {
    type: 'wave',
    id: 'sunset-bloom',
    label: 'Sunset Bloom',
    backgroundColor: '#2b0a1a',
    blobs: [
      { xPct: 20, yPct: 20, radiusPct: 70, color: '#fb7185' },
      { xPct: 75, yPct: 30, radiusPct: 65, color: '#f59e0b' },
      { xPct: 50, yPct: 88, radiusPct: 70, color: '#7c3aed' }
    ]
  },
  {
    type: 'wave',
    id: 'ocean-depth',
    label: 'Ocean Depth',
    backgroundColor: '#031a26',
    blobs: [
      { xPct: 25, yPct: 20, radiusPct: 68, color: '#06b6d4' },
      { xPct: 78, yPct: 35, radiusPct: 62, color: '#2563eb' },
      { xPct: 50, yPct: 90, radiusPct: 72, color: '#0f172a' }
    ]
  }
];

export const GRADIENT_PRESETS: LinearWallpaperPreset[] = [
  {
    type: 'linear',
    id: 'sunrise',
    label: 'Sunrise',
    angleDeg: 135,
    colors: ['#f97316', '#fb7185', '#f59e0b']
  },
  {
    type: 'linear',
    id: 'coral',
    label: 'Coral',
    angleDeg: 135,
    colors: ['#fb923c', '#f43f5e', '#ec4899']
  },
  {
    type: 'linear',
    id: 'peach',
    label: 'Peach',
    angleDeg: 120,
    colors: ['#fda4af', '#fdba74', '#fde68a']
  },
  {
    type: 'linear',
    id: 'ocean',
    label: 'Ocean',
    angleDeg: 135,
    colors: ['#0ea5e9', '#22d3ee', '#0891b2']
  },
  {
    type: 'linear',
    id: 'mint',
    label: 'Mint',
    angleDeg: 135,
    colors: ['#34d399', '#22d3ee', '#3b82f6']
  },
  {
    type: 'linear',
    id: 'emerald',
    label: 'Emerald',
    angleDeg: 140,
    colors: ['#10b981', '#059669', '#0d9488']
  },
  {
    type: 'linear',
    id: 'dusk',
    label: 'Dusk',
    angleDeg: 135,
    colors: ['#fb923c', '#a855f7', '#6366f1']
  },
  {
    type: 'linear',
    id: 'sky',
    label: 'Sky',
    angleDeg: 135,
    colors: ['#38bdf8', '#818cf8', '#c084fc']
  },
  {
    type: 'linear',
    id: 'candy',
    label: 'Candy',
    angleDeg: 135,
    colors: ['#f472b6', '#c084fc', '#818cf8']
  },
  {
    type: 'linear',
    id: 'violet',
    label: 'Violet',
    angleDeg: 145,
    colors: ['#8b5cf6', '#6366f1', '#4338ca']
  },
  {
    type: 'linear',
    id: 'grape',
    label: 'Grape',
    angleDeg: 135,
    colors: ['#a855f7', '#7c3aed', '#4c1d95']
  },
  {
    type: 'linear',
    id: 'midnight',
    label: 'Midnight',
    angleDeg: 135,
    colors: ['#1e293b', '#334155', '#475569']
  }
];

/** Waves first -- they're the primary "wallpaper" look; flat gradients are the simpler fallback. */
export const WALLPAPER_PRESETS: WallpaperPreset[] = [...WAVE_PRESETS, ...GRADIENT_PRESETS];

export function findWallpaperPreset(id: string | undefined): WallpaperPreset {
  return WALLPAPER_PRESETS.find((p) => p.id === id) ?? WALLPAPER_PRESETS[0];
}

/** CSS `background` value for rendering a preset in the renderer (thumbnails + live preview). */
export function cssGradient(preset: WallpaperPreset): string {
  if (preset.type === 'wave') {
    const blobs = preset.blobs
      .map(
        (b) =>
          `radial-gradient(ellipse ${b.radiusPct}% ${b.radiusPct}% at ${b.xPct}% ${b.yPct}%, ${b.color}, transparent)`
      )
      .join(', ');
    return `${blobs}, ${preset.backgroundColor}`;
  }
  return `linear-gradient(${preset.angleDeg}deg, ${preset.colors.join(', ')})`;
}
