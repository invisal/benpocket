import type { CSSProperties } from 'react';
import { cn } from 'cnfast';

export { cn };

// `-webkit-app-region` is Electron/Chromium-only and isn't part of
// React's CSSProperties type, so a plain `style={{ WebkitAppRegion: ... }}`
// doesn't type-check. Used on the custom titlebar (app/layout/TitleBar.tsx)
// to make the bar draggable while excluding buttons within it.
export type AppRegionStyle = CSSProperties & { WebkitAppRegion?: 'drag' | 'no-drag' };

export function appRegion(region: 'drag' | 'no-drag'): AppRegionStyle {
  return { WebkitAppRegion: region };
}
