import type { CursorGesture } from './cursor-path';

/** id into `CUSTOM_CURSOR_PATHS` (CursorStyleIcon.tsx) / `CUSTOM_CURSOR_GLYPHS` (export effects/cursor.ts) -- one of the 5 fully custom, fixed-color illustrations in features/cursor/svg/*.svg. */
export type CursorCustomIconId = 'cursor-1' | 'cursor-2' | 'cursor-3' | 'cursor-4' | 'cursor-5';

/**
 * Cursor style presets shared between the renderer (settings grid + live
 * preview overlay, both drawn as SVG/CSS) and the main-process export
 * compositor (drawn with node-canvas). Keeping the color data here means
 * both renderers stay pixel-identical instead of maintaining two palettes.
 */
export interface CursorStylePreset {
  id: string;
  /** Arrow fill color -- also what the shared hover-hand icon and click-ripple use, even for a `customIcon` preset (its own idle glyph is fixed-color and ignores this). */
  fill: string;
  /** Arrow outline color. Unused by `customIcon` presets (their idle glyph has no separate stroke pass -- its look comes entirely from its own per-path fill colors) and by the hover-hand icon (fill-only), but kept for type uniformity. */
  stroke: string;
  /**
   * When set, `idle` draws this fully custom, fixed-color illustration
   * instead of the shared plain arrow -- `hover` still swaps to the one
   * shared hand icon regardless, colored via `fill` same as every other
   * preset, so hover/drag/click-bounce/ripple behavior stays identical
   * across every style.
   */
  customIcon?: CursorCustomIconId;
}

export const CURSOR_STYLE_PRESETS: CursorStylePreset[] = [
  { id: 'coal', fill: '#18181b', stroke: '#ffffff' },
  { id: 'emerald', fill: '#22c55e', stroke: '#052e13' },
  { id: 'slate', fill: '#3f3f46', stroke: '#e4e4e7' },
  { id: 'crimson', fill: '#9f1239', stroke: '#fecdd3' },
  { id: 'ivory', fill: '#fafafa', stroke: '#18181b' },
  { id: 'rose', fill: '#ec4899', stroke: '#500724' },
  { id: 'mint', fill: '#4ade80', stroke: '#052e13' },
  { id: 'custom-1', fill: '#7972FE', stroke: '#020304', customIcon: 'cursor-1' },
  { id: 'custom-2', fill: '#B637DC', stroke: '#000000', customIcon: 'cursor-2' },
  { id: 'custom-3', fill: '#00C0FF', stroke: '#000000', customIcon: 'cursor-3' },
  { id: 'custom-4', fill: '#7FE8FE', stroke: '#020505', customIcon: 'cursor-4' },
  { id: 'custom-5', fill: '#7972FE', stroke: '#000000', customIcon: 'cursor-5' }
];

export const DEFAULT_CURSOR_STYLE_ID = 'coal';

export function resolveCursorStyle(id: string): CursorStylePreset {
  return CURSOR_STYLE_PRESETS.find((preset) => preset.id === id) ?? CURSOR_STYLE_PRESETS[0];
}

/** Reference-canvas px per `CursorSettings.size` unit (size is authored 2-20, default ~8.3). */
export const CURSOR_SIZE_UNIT_PX = 5;

/**
 * Anchor point, in each gesture icon's shared 24x24 authoring box, that
 * should land exactly on the recorded cursor position -- `idle`'s arrow
 * corner tip, and `hover`'s hand fingertip (its own glyph's topmost point,
 * sampled via `getPointAtLength()` rather than eyeballed -- see
 * CursorStyleIcon.tsx). Both the live-preview SVG (CursorStyleIcon.tsx) and
 * the export renderer (features/export/engine/rendering/effects/cursor.ts)
 * translate around this instead of the box's own (0,0) corner, so the glyph
 * never reads as offset from where the cursor actually is.
 */
export const CURSOR_GESTURE_HOTSPOTS: Record<CursorGesture, { x: number; y: number }> = {
  idle: { x: 5, y: 3 },
  hover: { x: 9.25, y: 0 }
};

/**
 * Per-`customIcon` hotspot, same 24x24 box and purpose as
 * `CURSOR_GESTURE_HOTSPOTS` -- only used when a preset's `idle` state draws
 * its own custom illustration instead of the shared arrow (see
 * `CursorStylePreset.customIcon`); `hover` always uses
 * `CURSOR_GESTURE_HOTSPOTS.hover` regardless of which custom icon is active.
 * Each is the icon's own "pointer tip" (its main body's topmost point,
 * found via its extreme sampled point, not eyeballed) -- picking the actual
 * arrow/triangle shape's tip rather than a decorative element (a floating
 * dot, a motion-line squiggle) that might sit further out.
 */
export const CURSOR_CUSTOM_ICON_HOTSPOTS: Record<CursorCustomIconId, { x: number; y: number }> = {
  'cursor-1': { x: 5.23, y: 4.25 },
  'cursor-2': { x: 2.57, y: 2.84 },
  'cursor-3': { x: 3.45, y: 3.69 },
  'cursor-4': { x: 10.11, y: 7.12 },
  'cursor-5': { x: 1.69, y: 4.13 }
};
