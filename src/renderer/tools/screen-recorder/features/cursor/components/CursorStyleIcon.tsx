import type { JSX } from 'react';
import type { CursorGesture } from '@shared/cursor-path';
import type { CursorCustomIconId } from '@shared/cursor-styles';
import { CUSTOM_CURSOR_PATHS } from './custom-cursor-paths';

interface CursorStyleIconProps {
  fill: string;
  stroke: string;
  size?: number;
  /** Which glyph to draw -- see `resolveCursorGesture` in cursor-path.ts. Defaults to the plain arrow, same as before this existed. */
  gesture?: CursorGesture;
  /** When set (see `CursorStylePreset.customIcon`), `idle` draws this fully custom, fixed-color illustration instead of the plain arrow -- ignored for `hover`, which always shows the shared hand icon. */
  customIcon?: CursorCustomIconId;
}

/** Pointing-hand body contour, authored in its own 32x32 box -- shared between the fill and outline-stroke passes below. */
const HAND_PATH_D =
  'M11.3,20.4c-0.3-0.4-0.6-1.1-1.2-2c-0.3-0.5-1.2-1.5-1.5-1.9' +
  'c-0.2-0.4-0.2-0.6-0.1-1c0.1-0.6,0.7-1.1,1.4-1.1c0.5,0,1,0.4,1.4,0.7c0.2,0.2,0.5,0.6,0.7,0.8c0.2,0.2,0.2,0.3,0.4,0.5' +
  'c0.2,0.3,0.3,0.5,0.2,0.1c-0.1-0.5-0.2-1.3-0.4-2.1c-0.1-0.6-0.2-0.7-0.3-1.1c-0.1-0.5-0.2-0.8-0.3-1.3c-0.1-0.3-0.2-1.1-0.3-1.5' +
  'c-0.1-0.5-0.1-1.4,0.3-1.8c0.3-0.3,0.9-0.4,1.3-0.2c0.5,0.3,0.8,1,0.9,1.3c0.2,0.5,0.4,1.2,0.5,2c0.2,1,0.5,2.5,0.5,2.8' +
  'c0-0.4-0.1-1.1,0-1.5c0.1-0.3,0.3-0.7,0.7-0.8c0.3-0.1,0.6-0.1,0.9-0.1c0.3,0.1,0.6,0.3,0.8,0.5c0.4,0.6,0.4,1.9,0.4,1.8' +
  'c0.1-0.4,0.1-1.2,0.3-1.6c0.1-0.2,0.5-0.4,0.7-0.5c0.3-0.1,0.7-0.1,1,0c0.2,0,0.6,0.3,0.7,0.5c0.2,0.3,0.3,1.3,0.4,1.7' +
  'c0,0.1,0.1-0.4,0.3-0.7c0.4-0.6,1.8-0.8,1.9,0.6c0,0.7,0,0.6,0,1.1c0,0.5,0,0.8,0,1.2c0,0.4-0.1,1.3-0.2,1.7' +
  'c-0.1,0.3-0.4,1-0.7,1.4c0,0-1.1,1.2-1.2,1.8c-0.1,0.6-0.1,0.6-0.1,1c0,0.4,0.1,0.9,0.1,0.9s-0.8,0.1-1.2,0c-0.4-0.1-0.9-0.8-1-1.1' +
  'c-0.2-0.3-0.5-0.3-0.7,0c-0.2,0.4-0.7,1.1-1.1,1.1c-0.7,0.1-2.1,0-3.1,0c0,0,0.2-1-0.2-1.4c-0.3-0.3-0.8-0.8-1.1-1.1L11.3,20.4z';

/** Finger-crease lines drawn on top of the hand body, same 32x32 box as `HAND_PATH_D`. */
const HAND_FINGER_LINES: [number, number, number, number][] = [
  [19.6, 20.7, 19.6, 17.3],
  [17.6, 20.7, 17.5, 17.3],
  [15.6, 17.3, 15.6, 20.7]
];

/**
 * The hand's own 32x32 box only fills about half of the shared 24x24 one
 * once naively rescaled (`24/32`), reading visibly smaller than the arrow
 * glyph (which fills most of its box) at the same `size`. Boosted here,
 * scaled up around the box's own center (12,12) rather than its (0,0)
 * corner so it grows in place instead of drifting toward a corner --
 * `CURSOR_GESTURE_HOTSPOTS.hover` and cursor.ts's `CURSOR_HOVER_GLYPH` are
 * both derived from this same boosted transform, so preview and export
 * stay in sync.
 */
const HAND_ICON_BOOST = 1.75;
const HAND_ICON_SCALE = (24 / 32) * HAND_ICON_BOOST;
const HAND_ICON_OFFSET = 12 * (1 - HAND_ICON_BOOST);

/**
 * The classic angled arrow-pointer glyph, in the given fill/outline colors --
 * or, for a `customIcon` preset, one of the 5 fully custom, fixed-color
 * illustrations (features/cursor/svg/*.svg) instead. `hover` always draws
 * the shared pointing-hand glyph regardless, itself fixed-color (white
 * body, black outline). Shared shape between the settings grid, the live
 * preview overlay, and (via the same path data mirrored in cursor.ts's
 * PixiJS renderer) the export compositor.
 */
export function CursorStyleIcon({
  fill,
  stroke,
  size = 22,
  gesture = 'idle',
  customIcon
}: CursorStyleIconProps): JSX.Element {
  const strokeProps = { fill, stroke, strokeWidth: 1.4, strokeLinejoin: 'round' as const };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {gesture === 'idle' && customIcon ? (
        // Fully custom illustration -- kept as its own native bezier path
        // data (not sampled -- browsers render curves natively) rescaled
        // from its 512x512 authoring box into this shared 24-unit one.
        // Each path keeps its own embedded fill color; `fill`/`stroke`
        // props are intentionally unused here (this glyph isn't
        // recolorable), unlike the plain arrow below.
        <g transform={`scale(${24 / 512})`}>
          {CUSTOM_CURSOR_PATHS[customIcon].map((p, i) => (
            <path key={i} d={p.d} fill={p.fill} transform={p.transform} />
          ))}
        </g>
      ) : gesture === 'hover' ? (
        // Pointing-hand icon, covering both hovering something clickable
        // and dragging (see `CursorGesture` -- there's no separate grab
        // glyph). Fixed white/black artwork -- like the customIcon
        // illustrations above (and unlike the plain arrow below), it
        // isn't recolored via `fill`/`stroke`, so it looks the same
        // regardless of which cursor color preset is active. Authored in
        // its own 32x32 box and rescaled into this shared 24-unit one via
        // the wrapping `<g>`. Fingertip hotspot (CURSOR_GESTURE_HOTSPOTS)
        // is this contour's own topmost point.
        <g
          transform={`translate(${HAND_ICON_OFFSET},${HAND_ICON_OFFSET}) scale(${HAND_ICON_SCALE})`}
        >
          <path d={HAND_PATH_D} fill="#ffffff" />
          <path
            d={HAND_PATH_D}
            fill="none"
            stroke="#000000"
            strokeWidth={0.75}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {HAND_FINGER_LINES.map(([x1, y1, x2, y2], i) => (
            <line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="#000000"
              strokeWidth={0.75}
              strokeLinecap="round"
            />
          ))}
        </g>
      ) : (
        <path
          d="M5 3 L5 20.5 L9.5 16.2 L12.3 21.8 L15 20.4 L12.1 14.8 L18.5 14.5 Z"
          {...strokeProps}
        />
      )}
    </svg>
  );
}
