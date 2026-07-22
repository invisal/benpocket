import { BlurFilter, Container, Graphics, Sprite, type Texture } from 'pixi.js';
import type { BlurMaskSceneData, InnerRect } from '../types';

function traceRegion(g: Graphics, region: BlurMaskSceneData): Graphics {
  if (region.shape === 'ellipse') {
    return g.ellipse(
      region.xPx + region.widthPx / 2,
      region.yPx + region.heightPx / 2,
      region.widthPx / 2,
      region.heightPx / 2
    );
  }
  return g.rect(region.xPx, region.yPx, region.widthPx, region.heightPx);
}

interface Slot {
  container: Container;
  maskGraphics: Graphics;
  blurSprite: Sprite;
  blurFilter: BlurFilter;
  colorGraphics: Graphics;
}

/**
 * Blur/mask redaction regions, drawn on top of the video frame. `kind:'blur'`
 * blurs the video content itself within the region (a second `Sprite` of the
 * *same* video texture, masked to the region and run through a real GPU
 * `BlurFilter` -- replacing frame-compositor.ts's shrink-canvas
 * approximation); `kind:'mask'` is a flat color fill.
 */
export class BlurMasksEffect {
  private readonly parent: Container;
  private readonly slots: Slot[] = [];

  constructor(parent: Container) {
    this.parent = parent;
  }

  update(regions: BlurMaskSceneData[], videoTexture: Texture, innerRect: InnerRect): void {
    while (this.slots.length < regions.length) this.slots.push(this.createSlot());

    this.slots.forEach((slot, i) => {
      const region = regions[i];
      if (!region) {
        slot.container.visible = false;
        return;
      }
      slot.container.visible = true;
      slot.maskGraphics.clear();
      traceRegion(slot.maskGraphics, region).fill(0xffffff);

      if (region.kind === 'mask') {
        slot.blurSprite.visible = false;
        slot.colorGraphics.visible = true;
        slot.colorGraphics.clear();
        traceRegion(slot.colorGraphics, region).fill(region.color);
      } else {
        slot.colorGraphics.visible = false;
        slot.blurSprite.visible = true;
        slot.blurSprite.texture = videoTexture;
        // Sized/positioned to match the main video sprite exactly (not just
        // this region's sub-rect) -- the region mask above is what actually
        // crops it down, same as frame-compositor.ts blurring a copy of the
        // whole scratch canvas and relying on the clip to bound it.
        slot.blurSprite.x = innerRect.x;
        slot.blurSprite.y = innerRect.y;
        slot.blurSprite.width = innerRect.width;
        slot.blurSprite.height = innerRect.height;
        slot.blurFilter.strength = region.blurPx * 2;
        slot.blurSprite.filters = [slot.blurFilter];
      }
    });
  }

  private createSlot(): Slot {
    const container = new Container();
    const maskGraphics = new Graphics();
    // See shadow-corner.ts's constructor comment: `includeInBuild = false`,
    // not `renderable = false` -- the latter also breaks the mask itself.
    maskGraphics.includeInBuild = false;
    const blurSprite = new Sprite();
    const blurFilter = new BlurFilter({ strength: 0 });
    const colorGraphics = new Graphics();
    container.addChild(maskGraphics, blurSprite, colorGraphics);
    container.mask = maskGraphics;
    this.parent.addChild(container);
    return { container, maskGraphics, blurSprite, blurFilter, colorGraphics };
  }
}
