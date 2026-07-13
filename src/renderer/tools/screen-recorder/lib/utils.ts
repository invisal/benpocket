import type { CSSProperties } from 'react';
import { cn } from 'cnfast';

export { cn };

// `-webkit-app-region` is Electron/Chromium-only and isn't part of
// React's CSSProperties type, so a plain `style={{ WebkitAppRegion: ... }}`
// doesn't type-check.
export type AppRegionStyle = CSSProperties & { WebkitAppRegion?: 'drag' | 'no-drag' };

export function appRegion(region: 'drag' | 'no-drag'): AppRegionStyle {
  return { WebkitAppRegion: region };
}
