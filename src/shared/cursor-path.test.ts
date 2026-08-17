import { describe, expect, it } from 'vitest';
import { resolveClickBounceScale, type CursorPathPoint } from './cursor-path';

const CLICK_AT: CursorPathPoint[] = [{ atMs: 1000, x: 0.5, y: 0.5 }];

describe('resolveClickBounceScale', () => {
  it('has no effect outside the bounce window, at zero intensity, or with no clicks', () => {
    expect(resolveClickBounceScale(CLICK_AT, 999, 5)).toBe(1); // before the click
    expect(resolveClickBounceScale(CLICK_AT, 1000 + 1000, 5)).toBe(1); // long after
    expect(resolveClickBounceScale(CLICK_AT, 1100, 0)).toBe(1);
    expect(resolveClickBounceScale([], 1100, 5)).toBe(1);
  });

  it('eases in from exactly 1 at the click instant, with no snap', () => {
    expect(resolveClickBounceScale(CLICK_AT, 1000, 5)).toBeCloseTo(1);
  });

  it('returns to exactly 1 at the end of the bounce window, with no snap', () => {
    expect(resolveClickBounceScale(CLICK_AT, 1000 + 320, 5)).toBeCloseTo(1);
  });

  it('bottoms out at the midpoint of the window, scaling down (never overshooting past 1)', () => {
    const mid = resolveClickBounceScale(CLICK_AT, 1000 + 160, 5);
    expect(mid).toBeLessThan(1);
    for (let elapsed = 0; elapsed <= 320; elapsed += 10) {
      expect(resolveClickBounceScale(CLICK_AT, 1000 + elapsed, 5)).toBeLessThanOrEqual(1);
    }
  });

  it('is symmetric around the midpoint (smooth scale-in mirrors scale-out)', () => {
    const before = resolveClickBounceScale(CLICK_AT, 1000 + 100, 5);
    const after = resolveClickBounceScale(CLICK_AT, 1000 + (320 - 100), 5);
    expect(before).toBeCloseTo(after);
  });

  it('scales the dip depth with intensity', () => {
    const low = resolveClickBounceScale(CLICK_AT, 1000 + 160, 1);
    const high = resolveClickBounceScale(CLICK_AT, 1000 + 160, 5);
    expect(1 - high).toBeGreaterThan(1 - low);
  });
});
