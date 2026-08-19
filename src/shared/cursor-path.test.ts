import { describe, expect, it } from 'vitest';
import { resolveClickBounceScale, remapPathToCropSpace, type CursorPathPoint } from './cursor-path';

const CLICK_AT: CursorPathPoint[] = [{ atMs: 1000, x: 0.5, y: 0.5 }];

describe('remapPathToCropSpace', () => {
  const path: CursorPathPoint[] = [
    { atMs: 0, x: 0, y: 0 },
    { atMs: 100, x: 0.5, y: 0.75 },
    { atMs: 200, x: 1, y: 1 }
  ];

  it('returns the path unchanged when there is no crop', () => {
    expect(remapPathToCropSpace(path, null)).toBe(path);
  });

  it('maps a point at the crop rect origin to (0, 0)', () => {
    const [remapped] = remapPathToCropSpace(path, { x: 0.25, y: 0.25, width: 0.5, height: 0.5 });
    expect(remapped.x).toBeCloseTo(-0.5);
    expect(remapped.y).toBeCloseTo(-0.5);
  });

  it('maps a point already inside the crop back into [0, 1]', () => {
    const [, mid] = remapPathToCropSpace(path, { x: 0.25, y: 0.25, width: 0.5, height: 0.5 });
    expect(mid.x).toBeCloseTo(0.5);
    expect(mid.y).toBeCloseTo(1);
  });

  it('leaves a full-frame crop (x:0,y:0,width:1,height:1) as the identity transform', () => {
    const remapped = remapPathToCropSpace(path, { x: 0, y: 0, width: 1, height: 1 });
    expect(remapped).toEqual(path);
  });
});

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
