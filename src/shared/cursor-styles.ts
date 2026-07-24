/**
 * Cursor style presets shared between the renderer (settings grid + live
 * preview overlay, both drawn as SVG/CSS) and the main-process export
 * compositor (drawn with node-canvas). Keeping the color data here means
 * both renderers stay pixel-identical instead of maintaining two palettes.
 */
export interface CursorStylePreset {
  id: string;
  /** Arrow fill color. */
  fill: string;
  /** Arrow outline color. */
  stroke: string;
}

export const CURSOR_STYLE_PRESETS: CursorStylePreset[] = [
  { id: 'coal', fill: '#18181b', stroke: '#ffffff' },
  { id: 'emerald', fill: '#22c55e', stroke: '#052e13' },
  { id: 'slate', fill: '#3f3f46', stroke: '#e4e4e7' },
  { id: 'crimson', fill: '#9f1239', stroke: '#fecdd3' },
  { id: 'ivory', fill: '#fafafa', stroke: '#18181b' },
  { id: 'rose', fill: '#ec4899', stroke: '#500724' },
  { id: 'mint', fill: '#4ade80', stroke: '#052e13' },
  { id: 'magenta', fill: '#d946ef', stroke: '#4a044e' },
  { id: 'cloud', fill: '#e4e4e7', stroke: '#3f3f46' },
  { id: 'amber', fill: '#f59e0b', stroke: '#451a03' },
  { id: 'forest', fill: '#166534', stroke: '#dcfce7' },
  { id: 'violet', fill: '#7c3aed', stroke: '#ede9fe' }
];

export const DEFAULT_CURSOR_STYLE_ID = 'coal';

export function resolveCursorStyle(id: string): CursorStylePreset {
  return CURSOR_STYLE_PRESETS.find((preset) => preset.id === id) ?? CURSOR_STYLE_PRESETS[0];
}

/** Reference-canvas px per `CursorSettings.size` unit (size is authored 2-20, default ~8.3). */
export const CURSOR_SIZE_UNIT_PX = 5;
