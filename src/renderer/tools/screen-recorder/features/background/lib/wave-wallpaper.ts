import {
  cssGradient as sharedCssGradient,
  type WallpaperPreset,
  type WaveWallpaperPreset
} from '@shared/wallpaper-presets';

/**
 * screen-recorder-only enrichment of the shared "wave" wallpaper blobs --
 * more blobs per preset than `@shared/wallpaper-presets`, so the flowing
 * background reads as color melting into color rather than three visible
 * gradient circles. Kept local to this tool (not in the shared module,
 * which screen-capture also renders from) so screen-capture's look is
 * unaffected.
 */
const ENRICHED_BLOBS: Record<string, WaveWallpaperPreset['blobs']> = {
  'big-sur': [
    { xPct: 12, yPct: 18, radiusPct: 85, color: '#fb923c' },
    { xPct: 82, yPct: 12, radiusPct: 75, color: '#f97316' },
    { xPct: 88, yPct: 45, radiusPct: 80, color: '#0ea5e9' },
    { xPct: 30, yPct: 60, radiusPct: 70, color: '#facc15' },
    { xPct: 55, yPct: 90, radiusPct: 90, color: '#0f766e' },
    { xPct: 10, yPct: 88, radiusPct: 65, color: '#0369a1' }
  ],
  monterey: [
    { xPct: 20, yPct: 18, radiusPct: 82, color: '#c084fc' },
    { xPct: 78, yPct: 15, radiusPct: 75, color: '#a855f7' },
    { xPct: 90, yPct: 50, radiusPct: 78, color: '#ec4899' },
    { xPct: 15, yPct: 55, radiusPct: 68, color: '#6366f1' },
    { xPct: 55, yPct: 92, radiusPct: 88, color: '#fb923c' },
    { xPct: 85, yPct: 88, radiusPct: 60, color: '#f472b6' }
  ],
  sonoma: [
    { xPct: 15, yPct: 22, radiusPct: 78, color: '#67e8f9' },
    { xPct: 75, yPct: 12, radiusPct: 72, color: '#3b82f6' },
    { xPct: 92, yPct: 48, radiusPct: 76, color: '#22d3ee' },
    { xPct: 25, yPct: 60, radiusPct: 65, color: '#0ea5e9' },
    { xPct: 58, yPct: 92, radiusPct: 88, color: '#0891b2' },
    { xPct: 10, yPct: 90, radiusPct: 60, color: '#1e40af' }
  ],
  aurora: [
    { xPct: 22, yPct: 15, radiusPct: 80, color: '#5eead4' },
    { xPct: 78, yPct: 18, radiusPct: 75, color: '#34d399' },
    { xPct: 90, yPct: 52, radiusPct: 78, color: '#818cf8' },
    { xPct: 18, yPct: 58, radiusPct: 66, color: '#22c55e' },
    { xPct: 55, yPct: 92, radiusPct: 88, color: '#4c1d95' },
    { xPct: 85, yPct: 88, radiusPct: 58, color: '#6366f1' }
  ],
  'sunset-bloom': [
    { xPct: 18, yPct: 18, radiusPct: 82, color: '#fda4af' },
    { xPct: 80, yPct: 15, radiusPct: 75, color: '#fb7185' },
    { xPct: 92, yPct: 48, radiusPct: 78, color: '#f59e0b' },
    { xPct: 20, yPct: 58, radiusPct: 66, color: '#f43f5e' },
    { xPct: 55, yPct: 90, radiusPct: 88, color: '#7c3aed' },
    { xPct: 85, yPct: 88, radiusPct: 58, color: '#fbbf24' }
  ],
  'ocean-depth': [
    { xPct: 18, yPct: 18, radiusPct: 80, color: '#22d3ee' },
    { xPct: 80, yPct: 15, radiusPct: 74, color: '#06b6d4' },
    { xPct: 92, yPct: 50, radiusPct: 78, color: '#2563eb' },
    { xPct: 20, yPct: 58, radiusPct: 65, color: '#0284c7' },
    { xPct: 55, yPct: 92, radiusPct: 88, color: '#0f172a' },
    { xPct: 85, yPct: 86, radiusPct: 58, color: '#164e63' }
  ]
};

/** Swaps in the enriched blob set for a wave preset, if this preset id has one. */
export function enrichWallpaperPreset(preset: WallpaperPreset): WallpaperPreset {
  if (preset.type !== 'wave') return preset;
  const blobs = ENRICHED_BLOBS[preset.id];
  return blobs ? { ...preset, blobs } : preset;
}

/** `#rrggbb` -> `rgba(r, g, b, alpha)`, for building a gradual color-stop falloff. */
export function withAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Color stops for one wave blob's radial gradient -- a mid-stop that's
 * still mostly opaque (rather than jumping straight to transparent) is what
 * gives the blob a soft, melted-together edge instead of a visible ring.
 */
function blobColorStops(color: string): { offset: number; color: string }[] {
  return [
    { offset: 0, color },
    { offset: 0.55, color: withAlpha(color, 0.65) },
    { offset: 1, color: withAlpha(color, 0) }
  ];
}

/** CSS `background` value, using the enriched blob set + soft color-stop falloff for wave presets. */
export function cssGradient(preset: WallpaperPreset): string {
  const enriched = enrichWallpaperPreset(preset);
  if (enriched.type !== 'wave') return sharedCssGradient(enriched);
  const blobs = enriched.blobs
    .map((b) => {
      const stops = blobColorStops(b.color)
        .map((s) => `${s.color} ${s.offset * 100}%`)
        .join(', ');
      return `radial-gradient(ellipse ${b.radiusPct}% ${b.radiusPct}% at ${b.xPct}% ${b.yPct}%, ${stops})`;
    })
    .join(', ');
  return `${blobs}, ${enriched.backgroundColor}`;
}

/** Blur/scale applied to the flowing "wave" wallpapers so blobs melt together instead of reading as flat gradient rings -- matches the soft, out-of-focus look of macOS's own default wallpapers. Not applied to swatch thumbnails (too small for it to read as anything but mud). */
export const WAVE_BLUR_PX = 60;
export const WAVE_BLUR_SCALE = 1.18;

/**
 * `background`/`filter`/`transform` for a full-size CSS layer (live
 * preview) -- as opposed to `cssGradient()` alone, which is used for small
 * unblurred swatch thumbnails.
 */
export function wallpaperCssLayerStyle(preset: WallpaperPreset): {
  background: string;
  filter?: string;
  transform?: string;
} {
  if (enrichWallpaperPreset(preset).type === 'wave') {
    return {
      background: cssGradient(preset),
      filter: `blur(${WAVE_BLUR_PX}px)`,
      transform: `scale(${WAVE_BLUR_SCALE})`
    };
  }
  return { background: cssGradient(preset) };
}
