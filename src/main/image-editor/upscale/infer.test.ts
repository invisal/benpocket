import { describe, expect, it } from 'vitest';
import { planAxis } from './infer';

/** Every tile's core region must exactly tile [0, size) -- no gaps, no overlap, no pixel
 * dropped -- since `upscaleRgb` stitches tiles back together by copying each one's core
 * straight into the output buffer at `coreStart * scale`. */
function coversExactly(size: number, stride: number): boolean {
  const plan = planAxis(size, stride);
  let expected = 0;
  for (const tile of plan) {
    if (tile.coreStart !== expected || tile.coreLen <= 0) return false;
    expected += tile.coreLen;
  }
  return expected === size;
}

describe('planAxis', () => {
  it('covers an exact multiple of stride with equal-length tiles', () => {
    const plan = planAxis(224, 112);
    expect(plan).toEqual([
      { coreStart: 0, coreLen: 112 },
      { coreStart: 112, coreLen: 112 }
    ]);
    expect(coversExactly(224, 112)).toBe(true);
  });

  it('shortens only the last tile when size is not a multiple of stride', () => {
    const plan = planAxis(150, 112);
    expect(plan).toEqual([
      { coreStart: 0, coreLen: 112 },
      { coreStart: 112, coreLen: 38 }
    ]);
    expect(coversExactly(150, 112)).toBe(true);
  });

  it('produces a single short tile for images smaller than one stride', () => {
    expect(planAxis(50, 112)).toEqual([{ coreStart: 0, coreLen: 50 }]);
  });

  it('covers a range of sizes with no gaps or overlap', () => {
    for (let size = 1; size <= 500; size += 7) {
      expect(coversExactly(size, 112)).toBe(true);
    }
  });
});
