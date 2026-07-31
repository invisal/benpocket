import { Container, Graphics } from 'pixi.js';
import type { CursorSceneData, InnerRect } from '../types';

/** Same path data as CursorStyleIcon.tsx's SVG / frame-compositor.ts's `traceCursorIconPath`, authored in a 24x24 box. */
const CURSOR_PATH: [number, number][] = [
  [5, 3],
  [5, 20.5],
  [9.5, 16.2],
  [12.3, 21.8],
  [15, 20.4],
  [12.1, 14.8],
  [18.5, 14.5]
];
/** Local-space pivot (the glyph's tip) that click-bounce scales around, same as frame-compositor.ts's `drawCursorIcon`. */
const TIP: [number, number] = [5, 3];

/** Expanding, fading ring for the click-ripple effect -- see resolveClickRipple in cursor-path.ts. Drawn stroked-only (not filled) so it reads as a ring emanating outward, not a solid dot. */
function drawClickRippleInto(
  g: Graphics,
  x: number,
  y: number,
  radiusPx: number,
  color: string,
  alpha: number
): void {
  if (radiusPx <= 0 || alpha <= 0) return;
  g.circle(x, y, radiusPx).stroke({ color, width: Math.max(1.5, radiusPx * 0.08), alpha });
}

function drawCursorIconInto(
  g: Graphics,
  x: number,
  y: number,
  sizePx: number,
  fill: string,
  stroke: string,
  alpha: number,
  clickScale: number
): void {
  const s = sizePx / 24;
  // Anchored so the glyph's tip (TIP, not the path's local (0,0) corner)
  // lands exactly on (x, y) -- the actual recorded cursor/click position --
  // rather than offsetting the whole icon down-right by TIP*s.
  const pts = CURSOR_PATH.map(([px, py]) => {
    const lx = (px - TIP[0]) * clickScale;
    const ly = (py - TIP[1]) * clickScale;
    return [x + lx * s, y + ly * s];
  });
  g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
  g.closePath();
  g.fill({ color: fill, alpha });
  g.stroke({ color: stroke, width: 1.4 * s, alpha });
}

/** Recorded cursor + motion-blur ghost trail + click-bounce, redrawn into one `Graphics` per frame. */
export class CursorEffect {
  private readonly graphics = new Graphics();
  private readonly maskGraphics = new Graphics();
  private readonly container = new Container();

  constructor(parent: Container) {
    // See shadow-corner.ts's constructor comment: `includeInBuild = false`,
    // not `renderable = false` -- the latter also breaks the mask itself.
    this.maskGraphics.includeInBuild = false;
    this.container.addChild(this.maskGraphics, this.graphics);
    parent.addChild(this.container);
  }

  update(cursor: CursorSceneData | null, innerRect: InnerRect): void {
    this.graphics.clear();
    if (!cursor) {
      this.container.visible = false;
      return;
    }
    this.container.visible = true;

    if (cursor.clipToCanvas) {
      this.maskGraphics.clear();
      this.maskGraphics
        .rect(innerRect.x, innerRect.y, innerRect.width, innerRect.height)
        .fill(0xffffff);
      this.container.mask = this.maskGraphics;
    } else {
      this.container.mask = null;
    }

    if (cursor.ripple) {
      drawClickRippleInto(
        this.graphics,
        cursor.ripple.posPx.x,
        cursor.ripple.posPx.y,
        cursor.ripple.radiusPx,
        cursor.fill,
        cursor.ripple.alpha
      );
    }

    for (const ghost of cursor.ghosts) {
      drawCursorIconInto(
        this.graphics,
        ghost.posPx.x,
        ghost.posPx.y,
        cursor.sizePx,
        cursor.fill,
        cursor.stroke,
        ghost.alpha,
        1
      );
    }
    drawCursorIconInto(
      this.graphics,
      cursor.posPx.x,
      cursor.posPx.y,
      cursor.sizePx,
      cursor.fill,
      cursor.stroke,
      1,
      cursor.clickScale
    );
  }
}
