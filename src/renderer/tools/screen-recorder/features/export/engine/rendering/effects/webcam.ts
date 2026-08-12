import { BlurFilter, Container, Graphics, Sprite, type Texture } from 'pixi.js';
import type { WebcamSceneData } from '../types';

/** `rounded-square`'s own corner radius, proportional to its (un-inflated) size -- shared so the shadow pass below can grow this by `spreadPx` explicitly instead of letting a bigger `size` recompute a smaller proportional radius than that. */
function roundedSquareRadius(size: number): number {
  return size * 0.16;
}

function traceShape(
  g: Graphics,
  x: number,
  y: number,
  size: number,
  shape: WebcamSceneData['shape'],
  radiusOverride?: number
): Graphics {
  if (shape === 'circle') return g.circle(x + size / 2, y + size / 2, size / 2);
  if (shape === 'rounded-square') {
    return g.roundRect(x, y, size, size, radiusOverride ?? roundedSquareRadius(size));
  }
  return g.rect(x, y, size, size);
}

/**
 * Webcam PiP -- drawn untransformed (not a child of the zoom-transformed
 * content container) so it stays fixed on top regardless of content zoom,
 * matching frame-compositor.ts's `drawWebcamFrame`/`drawWebcamPlaceholder`.
 */
export class WebcamEffect {
  private readonly container = new Container();
  private readonly maskGraphics = new Graphics();
  private readonly sprite = new Sprite();
  private readonly placeholder = new Graphics();
  // Sibling of `container`, not a child of it -- `container.mask` clips
  // everything inside `container`, which would clip away a shadow drawn
  // there too. Added to `parent` right before `container` so it renders
  // behind the PiP instead, same split `shadow-corner.ts` uses for the
  // background shadow vs. its own mask.
  private readonly shadowGraphics = new Graphics();
  private readonly blurFilter = new BlurFilter({ strength: 0 });

  constructor(parent: Container) {
    // See shadow-corner.ts's constructor comment: `includeInBuild = false`,
    // not `renderable = false` -- the latter also breaks the mask itself.
    this.maskGraphics.includeInBuild = false;
    this.container.addChild(this.maskGraphics, this.placeholder, this.sprite);
    this.container.mask = this.maskGraphics;
    parent.addChild(this.shadowGraphics, this.container);
  }

  update(webcam: WebcamSceneData | null, texture: Texture | undefined): void {
    this.maskGraphics.clear();
    this.placeholder.clear();
    this.shadowGraphics.clear();
    if (!webcam) {
      this.container.visible = false;
      this.shadowGraphics.visible = false;
      return;
    }
    this.container.visible = true;
    traceShape(this.maskGraphics, webcam.xPx, webcam.yPx, webcam.sizePx, webcam.shape).fill(
      0xffffff
    );

    if (webcam.shadow) {
      // Grown by `spreadPx` on every edge (not shifted), same symmetric
      // treatment as shadow-corner.ts. `rounded-square`'s corner radius is
      // grown by that same `spreadPx` explicitly (CSS `box-shadow`'s own
      // corner-radius-plus-spread rule -- WebcamPip.tsx gets this for free
      // from the browser) rather than left to `traceShape`'s usual
      // recompute-from-size, which would only grow the radius ~32% as fast
      // as the box itself and read as smaller/sharper than the preview at
      // any real spread amount.
      this.shadowGraphics.visible = true;
      const spread = webcam.shadow.spreadPx;
      traceShape(
        this.shadowGraphics,
        webcam.xPx - spread,
        webcam.yPx - spread,
        webcam.sizePx + spread * 2,
        webcam.shape,
        webcam.shape === 'rounded-square' ? roundedSquareRadius(webcam.sizePx) + spread : undefined
      ).fill({ color: 0x000000, alpha: webcam.shadow.alpha });
      // See shadow-corner.ts's comment on why `blurPx` (a CSS-style blur
      // radius) is halved for Pixi's `BlurFilter.strength` (a std. deviation).
      this.blurFilter.strength = webcam.shadow.blurPx / 2;
      this.shadowGraphics.filters = webcam.shadow.blurPx > 0 ? [this.blurFilter] : [];
    } else {
      this.shadowGraphics.visible = false;
    }

    if (texture) {
      this.placeholder.visible = false;
      this.sprite.visible = true;
      this.sprite.texture = texture;
      this.sprite.height = webcam.sizePx;
      this.sprite.y = webcam.yPx;
      if (webcam.mirrored) {
        this.sprite.width = -webcam.sizePx;
        this.sprite.x = webcam.xPx + webcam.sizePx;
      } else {
        this.sprite.width = webcam.sizePx;
        this.sprite.x = webcam.xPx;
      }
    } else {
      this.sprite.visible = false;
      this.placeholder.visible = true;
      traceShape(this.placeholder, webcam.xPx, webcam.yPx, webcam.sizePx, webcam.shape)
        .fill({ color: 0x141418, alpha: 0.9 })
        .stroke({ color: 0xffffff, width: Math.max(2, webcam.sizePx * 0.015), alpha: 0.25 });
    }
  }
}
