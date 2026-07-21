import { Assets, type Container, Graphics, Sprite, Text, Texture } from 'pixi.js';
import type { AnnotationSceneData } from '../types';

type ArrowData = Extract<AnnotationSceneData, { kind: 'arrow' }>;

type AnnotationHandle =
  | { kind: 'text'; text: Text }
  | { kind: 'arrow'; graphics: Graphics }
  | { kind: 'image'; sprite: Sprite; assetPath: string };

function drawDashedLine(
  g: Graphics,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  dashLength: number,
  gapLength: number
): void {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.hypot(dx, dy);
  if (length === 0) return;
  const ux = dx / length;
  const uy = dy / length;
  let distance = 0;
  while (distance < length) {
    const segEnd = Math.min(distance + dashLength, length);
    g.moveTo(x1 + ux * distance, y1 + uy * distance);
    g.lineTo(x1 + ux * segEnd, y1 + uy * segEnd);
    distance = segEnd + gapLength;
  }
}

/** Shaft (solid or dashed) + a two-line arrowhead (always solid), matching frame-compositor.ts's `drawArrow`. */
function drawArrow(g: Graphics, a: ArrowData): void {
  g.clear();
  const angle = Math.atan2(a.y2 - a.y1, a.x2 - a.x1);

  if (a.dashed) {
    drawDashedLine(g, a.x1, a.y1, a.x2, a.y2, a.lineWidthPx * 2.5, a.lineWidthPx * 1.8);
  } else {
    g.moveTo(a.x1, a.y1).lineTo(a.x2, a.y2);
  }
  g.moveTo(a.x2, a.y2).lineTo(
    a.x2 - a.headLengthPx * Math.cos(angle - Math.PI / 6),
    a.y2 - a.headLengthPx * Math.sin(angle - Math.PI / 6)
  );
  g.moveTo(a.x2, a.y2).lineTo(
    a.x2 - a.headLengthPx * Math.cos(angle + Math.PI / 6),
    a.y2 - a.headLengthPx * Math.sin(angle + Math.PI / 6)
  );
  g.stroke({ width: a.lineWidthPx, color: a.color });
}

/**
 * Text/arrow/image annotations, drawn untransformed on top of everything
 * (matches frame-compositor.ts's `drawAnnotations`). Pixi display objects
 * are kept alive and reused across frames, keyed by annotation id, rather
 * than recreated every frame -- `Text` objects in particular are relatively
 * expensive to construct (font layout).
 */
export class AnnotationsEffect {
  private readonly parent: Container;
  private readonly handles = new Map<string, AnnotationHandle>();

  constructor(parent: Container) {
    this.parent = parent;
  }

  async update(annotations: AnnotationSceneData[]): Promise<void> {
    const activeIds = new Set(annotations.map((a) => a.id));
    for (const [id, handle] of this.handles) {
      if (!activeIds.has(id)) {
        this.destroyHandle(handle);
        this.handles.delete(id);
      }
    }
    for (const annotation of annotations) {
      await this.updateOne(annotation);
    }
  }

  private async updateOne(annotation: AnnotationSceneData): Promise<void> {
    if (annotation.kind === 'text') {
      let handle = this.handles.get(annotation.id);
      if (!handle || handle.kind !== 'text') {
        if (handle) this.destroyHandle(handle);
        const text = new Text({
          text: annotation.text,
          style: { fill: '#ffffff', fontFamily: 'sans-serif' }
        });
        this.parent.addChild(text);
        handle = { kind: 'text', text };
        this.handles.set(annotation.id, handle);
      }
      handle.text.text = annotation.text;
      handle.text.style.fontSize = annotation.fontPx;
      handle.text.x = annotation.xPx;
      handle.text.y = annotation.yPx;
      return;
    }

    if (annotation.kind === 'arrow') {
      let handle = this.handles.get(annotation.id);
      if (!handle || handle.kind !== 'arrow') {
        if (handle) this.destroyHandle(handle);
        const graphics = new Graphics();
        this.parent.addChild(graphics);
        handle = { kind: 'arrow', graphics };
        this.handles.set(annotation.id, handle);
      }
      drawArrow(handle.graphics, annotation);
      return;
    }

    let handle = this.handles.get(annotation.id);
    if (!handle || handle.kind !== 'image' || handle.assetPath !== annotation.assetPath) {
      if (handle) this.destroyHandle(handle);
      const sprite = new Sprite();
      try {
        sprite.texture = await Assets.load<Texture>(annotation.assetPath);
      } catch {
        sprite.texture = Texture.EMPTY;
      }
      this.parent.addChild(sprite);
      handle = { kind: 'image', sprite, assetPath: annotation.assetPath };
      this.handles.set(annotation.id, handle);
    }
    handle.sprite.x = annotation.xPx;
    handle.sprite.y = annotation.yPx;
    handle.sprite.width = handle.sprite.texture.width * annotation.scale;
    handle.sprite.height = handle.sprite.texture.height * annotation.scale;
  }

  private destroyHandle(handle: AnnotationHandle): void {
    if (handle.kind === 'text') {
      this.parent.removeChild(handle.text);
      handle.text.destroy();
    } else if (handle.kind === 'arrow') {
      this.parent.removeChild(handle.graphics);
      handle.graphics.destroy();
    } else {
      this.parent.removeChild(handle.sprite);
      handle.sprite.destroy();
    }
  }
}
