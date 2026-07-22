import { BlurFilter, type Container, Graphics } from 'pixi.js';
import type { InnerRect, ShadowSceneData } from '../types';

/**
 * Casts a soft drop shadow behind the content rect (real GPU `BlurFilter`
 * instead of node-canvas's `ctx.shadow*`) and exposes the rounded-rect mask
 * used to clip the content layer to `innerRect` -- paired here because both
 * need the same `innerRect`/`radiusPx`, matching frame-compositor.ts's
 * `drawContentShadow` + the roundRect clip drawn right after it.
 */
export class ShadowCornerEffect {
  readonly shadowGraphics = new Graphics();
  readonly maskGraphics = new Graphics();
  private readonly blurFilter = new BlurFilter({ strength: 0 });

  constructor(shadowParent: Container, maskParent: Container) {
    shadowParent.addChild(this.shadowGraphics);
    // Only ever referenced via another container's `.mask` -- not meant to
    // draw its white fill directly. `includeInBuild = false` (not
    // `renderable = false`) is the correct way to hide it from the normal
    // render pass: Pixi's StencilMaskPipe explicitly force-flips
    // `includeInBuild` back to `true` for the duration of the dedicated
    // mask-collection pass, so this only skips the *normal* pass -- whereas
    // `renderable` gates both passes identically (it's baked into
    // `globalDisplayStatus`, which the mask pass does NOT override), so
    // setting `renderable = false` here would make the mask collect zero
    // geometry, clipping the masked content to nothing.
    this.maskGraphics.includeInBuild = false;
    maskParent.addChild(this.maskGraphics);
  }

  update(innerRect: InnerRect, radiusPx: number, shadow: ShadowSceneData | null): void {
    this.maskGraphics.clear();
    this.maskGraphics
      .roundRect(innerRect.x, innerRect.y, innerRect.width, innerRect.height, radiusPx)
      .fill(0xffffff);

    this.shadowGraphics.clear();
    if (!shadow) {
      this.shadowGraphics.filters = [];
      return;
    }
    this.shadowGraphics
      .roundRect(
        innerRect.x,
        innerRect.y + shadow.offsetYPx,
        innerRect.width,
        innerRect.height,
        radiusPx
      )
      .fill({ color: 0x000000, alpha: shadow.alpha });
    this.blurFilter.strength = shadow.blurPx;
    this.shadowGraphics.filters = shadow.blurPx > 0 ? [this.blurFilter] : [];
  }
}
