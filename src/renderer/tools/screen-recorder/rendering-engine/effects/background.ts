import {
  Assets,
  BlurFilter,
  type Container,
  FillGradient,
  Graphics,
  Sprite,
  Texture
} from 'pixi.js';
import type { BackgroundSceneData } from '../types';

/**
 * Fills the full output canvas behind the content -- color/gradient/wallpaper
 * (wallpaper is pre-resolved to a linear-gradient by timeline-evaluator.ts,
 * same as frame-compositor.ts's `drawBackground` treats it) via `Graphics`,
 * or a cover-fit image via `Sprite`. Blur uses PixiJS's real GPU
 * `BlurFilter` -- unlike the old node-canvas compositor, no shrink-canvas
 * approximation is needed.
 */
export class BackgroundEffect {
  private readonly graphics = new Graphics();
  private readonly sprite = new Sprite();
  private readonly blurFilter = new BlurFilter({ strength: 0 });
  private lastImagePath: string | null = null;
  private width = 0;
  private height = 0;

  constructor(parent: Container) {
    this.sprite.visible = false;
    parent.addChild(this.graphics);
    parent.addChild(this.sprite);
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
  }

  async update(data: BackgroundSceneData): Promise<void> {
    const { width, height } = this;

    if (data.kind === 'image') {
      this.graphics.visible = false;
      this.sprite.visible = true;
      if (this.lastImagePath !== data.path) {
        this.lastImagePath = data.path;
        try {
          this.sprite.texture = await Assets.load<Texture>(data.path);
        } catch {
          this.sprite.texture = Texture.EMPTY;
        }
      }
      const tex = this.sprite.texture;
      if (tex.width > 0 && tex.height > 0) {
        const scale = Math.max(width / tex.width, height / tex.height);
        this.sprite.width = tex.width * scale;
        this.sprite.height = tex.height * scale;
        this.sprite.x = (width - this.sprite.width) / 2;
        this.sprite.y = (height - this.sprite.height) / 2;
      }
      if (data.blurPx > 0) {
        this.blurFilter.strength = data.blurPx * 2;
        this.sprite.filters = [this.blurFilter];
      } else {
        this.sprite.filters = [];
      }
      return;
    }

    this.sprite.visible = false;
    this.graphics.visible = true;
    this.graphics.clear();

    if (data.kind === 'color') {
      this.graphics.rect(0, 0, width, height).fill(data.color);
      return;
    }

    // Same angle convention as CSS linear-gradient() (0deg = up, clockwise),
    // matching frame-compositor.ts's fillLinearGradient and the live preview.
    const angleRad = (data.angleDeg * Math.PI) / 180;
    const dx = Math.sin(angleRad);
    const dy = -Math.cos(angleRad);
    const colors = data.colors.length > 1 ? data.colors : [data.colors[0], data.colors[0]];
    const gradient = new FillGradient({
      type: 'linear',
      start: { x: 0.5 - dx / 2, y: 0.5 - dy / 2 },
      end: { x: 0.5 + dx / 2, y: 0.5 + dy / 2 },
      colorStops: colors.map((color, i) => ({
        offset: i / (colors.length - 1),
        color
      }))
    });
    this.graphics.rect(0, 0, width, height).fill(gradient);
  }
}
