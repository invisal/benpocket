import { Container, Graphics, Sprite, type Texture } from 'pixi.js';
import type { WebcamSceneData } from '../types';

function traceShape(
  g: Graphics,
  x: number,
  y: number,
  size: number,
  shape: WebcamSceneData['shape']
): Graphics {
  if (shape === 'circle') return g.circle(x + size / 2, y + size / 2, size / 2);
  if (shape === 'rounded-square') return g.roundRect(x, y, size, size, size * 0.16);
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

  constructor(parent: Container) {
    // See shadow-corner.ts's constructor comment: `includeInBuild = false`,
    // not `renderable = false` -- the latter also breaks the mask itself.
    this.maskGraphics.includeInBuild = false;
    this.container.addChild(this.maskGraphics, this.placeholder, this.sprite);
    this.container.mask = this.maskGraphics;
    parent.addChild(this.container);
  }

  update(webcam: WebcamSceneData | null, texture: Texture | undefined): void {
    this.maskGraphics.clear();
    this.placeholder.clear();
    if (!webcam) {
      this.container.visible = false;
      return;
    }
    this.container.visible = true;
    traceShape(this.maskGraphics, webcam.xPx, webcam.yPx, webcam.sizePx, webcam.shape).fill(
      0xffffff
    );

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
