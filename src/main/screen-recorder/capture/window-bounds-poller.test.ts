import { describe, expect, it } from 'vitest';
import { sizeChanged } from './window-bounds-poller';

describe('sizeChanged', () => {
  it('is false when bounds are identical', () => {
    expect(
      sizeChanged({ x: 0, y: 0, width: 800, height: 600 }, { x: 0, y: 0, width: 800, height: 600 })
    ).toBe(false);
  });

  it('is false for a plain window move (position changes, size does not) -- the regression this guards against', () => {
    // A title-bar drag to reposition the window changes x/y but leaves
    // width/height untouched -- this must never read as a resize.
    expect(
      sizeChanged(
        { x: 0, y: 0, width: 800, height: 600 },
        { x: 200, y: 150, width: 800, height: 600 }
      )
    ).toBe(false);
  });

  it('is true when width changes', () => {
    expect(
      sizeChanged({ x: 0, y: 0, width: 800, height: 600 }, { x: 0, y: 0, width: 900, height: 600 })
    ).toBe(true);
  });

  it('is true when height changes', () => {
    expect(
      sizeChanged({ x: 0, y: 0, width: 800, height: 600 }, { x: 0, y: 0, width: 800, height: 700 })
    ).toBe(true);
  });

  it('is true when both position and size change (a corner drag)', () => {
    expect(
      sizeChanged({ x: 0, y: 0, width: 800, height: 600 }, { x: 50, y: 0, width: 750, height: 600 })
    ).toBe(true);
  });
});
