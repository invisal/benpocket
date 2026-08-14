import { describe, expect, it } from 'vitest';
import { imageLayerRect } from './image-layer';

describe('imageLayerRect', () => {
  it('centers a smaller image at native size', () => {
    expect(imageLayerRect(100, 50, { x: 0, y: 0, width: 1000, height: 800 })).toEqual({
      x: 450,
      y: 375,
      width: 100,
      height: 50
    });
  });

  it('scales down to 80% of the view when the image is larger', () => {
    const rect = imageLayerRect(2000, 1000, { x: 10, y: 20, width: 400, height: 300 });
    expect(rect.width).toBe(320);
    expect(rect.height).toBe(160);
    expect(rect.x).toBe(10 + (400 - 320) / 2);
    expect(rect.y).toBe(20 + (300 - 160) / 2);
  });
});
