import { Container, Graphics, Text } from 'pixi.js';
import type { CaptionSceneData } from '../types';

/**
 * New: the old node-canvas compositor never drew captions at all (only the
 * live preview did, as a DOM `<p>` -- see PreviewStage.tsx). Bottom-centered
 * pill, sized in `REFERENCE_CANVAS_WIDTH` units like every other overlay.
 */
export class CaptionEffect {
  private readonly container = new Container();
  private readonly background = new Graphics();
  private readonly text = new Text({
    text: '',
    style: { fill: '#ffffff', fontFamily: 'sans-serif', align: 'center' }
  });

  constructor(parent: Container) {
    this.container.addChild(this.background, this.text);
    parent.addChild(this.container);
  }

  update(
    caption: CaptionSceneData | null,
    outputWidth: number,
    outputHeight: number,
    referenceScale: number
  ): void {
    this.background.clear();
    if (!caption) {
      this.container.visible = false;
      return;
    }
    this.container.visible = true;

    this.text.style.fontSize = Math.round(30 * referenceScale);
    this.text.style.wordWrap = true;
    this.text.style.wordWrapWidth = outputWidth * 0.8;
    this.text.text = caption.text;

    const paddingX = this.text.style.fontSize * 0.6;
    const paddingY = this.text.style.fontSize * 0.35;
    this.text.x = (outputWidth - this.text.width) / 2;
    this.text.y = outputHeight - this.text.height - outputHeight * 0.08;

    this.background
      .roundRect(
        this.text.x - paddingX,
        this.text.y - paddingY,
        this.text.width + paddingX * 2,
        this.text.height + paddingY * 2,
        (this.text.style.fontSize as number) * 0.3
      )
      .fill({ color: 0x000000, alpha: 0.55 });
  }
}
