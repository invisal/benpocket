import { describe, expect, it } from 'vitest';
import { resizeRect } from './flatten';

describe('resizeRect', () => {
  const start = { x: 10, y: 20, width: 100, height: 50 };

  it('resizes freely without lockAspect', () => {
    expect(resizeRect(start, 'se', 20, 10, 8)).toEqual({
      x: 10,
      y: 20,
      width: 120,
      height: 60
    });
  });

  it('locks aspect to the dominant axis when lockAspect is set', () => {
    // Width delta dominates → height follows 2:1
    expect(resizeRect(start, 'se', 20, 0, 8, true)).toEqual({
      x: 10,
      y: 20,
      width: 120,
      height: 60
    });
  });

  it('keeps the opposite corner fixed when locking from nw', () => {
    const next = resizeRect(start, 'nw', -20, -10, 8, true);
    expect(next.width / next.height).toBeCloseTo(2);
    expect(next.x + next.width).toBeCloseTo(start.x + start.width);
    expect(next.y + next.height).toBeCloseTo(start.y + start.height);
  });
});
