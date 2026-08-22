import { describe, expect, it } from 'vitest';
import { hwcUint8ToChwNormalized } from './infer';

describe('hwcUint8ToChwNormalized', () => {
  it("scales by the tile's own max byte value (not a fixed 255), matching rembg", () => {
    // A single red pixel: the max byte in the tile is 200 (the R channel itself), so R
    // normalizes to 1.0, not 200/255 -- this is what the reference `rembg` preprocessing does.
    const rgb = Buffer.from([200, 0, 0]);
    const out = hwcUint8ToChwNormalized(rgb, 1, [0, 0, 0], [1, 1, 1]);
    expect(Array.from(out)).toEqual([1, 0, 0]);
  });

  it('applies (x/max - mean) / std per channel and lays out CHW (channel-major)', () => {
    // A 2x2 image (HWC): pixel 0 = pure red, pixel 1 = pure green, pixels 2-3 = black. Max byte
    // across the tile is 255, so each channel's own byte / 255 is exact.
    // prettier-ignore
    const rgb = Buffer.from([
      255, 0, 0,
      0, 255, 0,
      0, 0, 0,
      0, 0, 0
    ]);
    const out = hwcUint8ToChwNormalized(rgb, 2, [0.5, 0.5, 0.5], [1, 1, 1]);

    const plane = 4;
    // R plane: pixel 0 is full red -> 1 - 0.5, the rest are 0 - 0.5.
    expect(Array.from(out.slice(0, plane))).toEqual([0.5, -0.5, -0.5, -0.5]);
    // G plane: pixel 1 is full green -> 1 - 0.5, the rest are 0 - 0.5.
    expect(Array.from(out.slice(plane, 2 * plane))).toEqual([-0.5, 0.5, -0.5, -0.5]);
    // B plane: untouched everywhere -> 0 - 0.5.
    expect(Array.from(out.slice(2 * plane, 3 * plane))).toEqual([-0.5, -0.5, -0.5, -0.5]);
  });
});
