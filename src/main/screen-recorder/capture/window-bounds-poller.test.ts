import { describe, expect, it } from 'vitest';
import { sizeChanged, resolveWindowResizeRotationDeg } from './window-bounds-poller';

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

describe('resolveWindowResizeRotationDeg', () => {
  const base = { x: 0, y: 0, width: 800, height: 600 };

  it('is horizontal (0) when only width changed -- a left/right edge drag', () => {
    expect(resolveWindowResizeRotationDeg(base, { ...base, width: 900 })).toBe(0);
  });

  it('is vertical (90) when only height changed -- a top/bottom edge drag', () => {
    expect(resolveWindowResizeRotationDeg(base, { ...base, height: 700 })).toBe(90);
  });

  it('is the "\\" diagonal (45) for a bottom-right corner drag -- origin fixed, both dimensions grow', () => {
    expect(resolveWindowResizeRotationDeg(base, { ...base, width: 900, height: 700 })).toBe(45);
  });

  it('is the "\\" diagonal (45) for a top-left corner drag -- origin and both dimensions move together', () => {
    expect(
      resolveWindowResizeRotationDeg(base, { x: -100, y: -100, width: 900, height: 700 })
    ).toBe(45);
  });

  it('is the "/" diagonal (135) for a top-right corner drag -- only y/height move, x/width fixed the other way', () => {
    expect(resolveWindowResizeRotationDeg(base, { x: 0, y: -100, width: 900, height: 700 })).toBe(
      135
    );
  });

  it('is the "/" diagonal (135) for a bottom-left corner drag -- only x/width move, y/height fixed the other way', () => {
    expect(resolveWindowResizeRotationDeg(base, { x: -100, y: 0, width: 900, height: 700 })).toBe(
      135
    );
  });
});
