import { describe, expect, it } from 'vitest';
import {
  resolveClickBounceScale,
  remapPathToCropSpace,
  resolveResizeRotationDeg,
  resolveActiveResizeRotationDeg,
  resolveCursorGesture,
  type CursorPathPoint,
  type WindowResizeSample,
  type CursorCrosshairSample,
  type CursorTextSelectSample
} from './cursor-path';

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

describe('resolveResizeRotationDeg', () => {
  it('is 0 for purely horizontal movement', () => {
    const path: CursorPathPoint[] = [
      { atMs: 0, x: 0.5, y: 0.5 },
      { atMs: 200, x: 0.7, y: 0.5 }
    ];
    expect(resolveResizeRotationDeg(path, 200)).toBe(0);
  });

  it('is 90 for purely vertical movement', () => {
    const path: CursorPathPoint[] = [
      { atMs: 0, x: 0.5, y: 0.5 },
      { atMs: 200, x: 0.5, y: 0.7 }
    ];
    expect(resolveResizeRotationDeg(path, 200)).toBe(90);
  });

  it('is 45 for diagonal movement toward the bottom-right (or top-left)', () => {
    const path: CursorPathPoint[] = [
      { atMs: 0, x: 0.5, y: 0.5 },
      { atMs: 200, x: 0.7, y: 0.7 }
    ];
    expect(resolveResizeRotationDeg(path, 200)).toBe(45);
  });

  it('is 135 for diagonal movement toward the top-right (or bottom-left)', () => {
    const path: CursorPathPoint[] = [
      { atMs: 0, x: 0.5, y: 0.5 },
      { atMs: 200, x: 0.7, y: 0.3 }
    ];
    expect(resolveResizeRotationDeg(path, 200)).toBe(135);
  });

  it('folds the opposite direction to the same orientation (a double-headed arrow looks identical rotated 180°)', () => {
    const path: CursorPathPoint[] = [
      { atMs: 0, x: 0.7, y: 0.5 },
      { atMs: 200, x: 0.5, y: 0.5 }
    ];
    expect(resolveResizeRotationDeg(path, 200)).toBe(0);
  });
});

describe('resolveActiveResizeRotationDeg', () => {
  it('prefers the exact orientation from an active resize sample over the cursor movement direction', () => {
    // Movement direction alone would read as vertical (dy dominates), but a
    // real cursor-shape sighting (rotationDeg: 0, i.e. horizontal) is a fact
    // and must win.
    const path: CursorPathPoint[] = [
      { atMs: 0, x: 0.5, y: 0.5 },
      { atMs: 200, x: 0.5, y: 0.9 }
    ];
    const resizePath: WindowResizeSample[] = [{ atMs: 150, rotationDeg: 0 }];
    expect(resolveActiveResizeRotationDeg(path, resizePath, 200)).toBe(0);
  });

  it('falls back to the movement-direction heuristic when the active sample has no rotationDeg (a whole-window bounds change, not a cursor-shape sighting)', () => {
    const path: CursorPathPoint[] = [
      { atMs: 0, x: 0.5, y: 0.5 },
      { atMs: 200, x: 0.5, y: 0.9 }
    ];
    const resizePath: WindowResizeSample[] = [{ atMs: 150 }];
    expect(resolveActiveResizeRotationDeg(path, resizePath, 200)).toBe(90);
  });

  it('falls back to the movement-direction heuristic when resize isn’t currently active at all', () => {
    const path: CursorPathPoint[] = [
      { atMs: 0, x: 0.5, y: 0.5 },
      { atMs: 200, x: 0.7, y: 0.5 }
    ];
    expect(resolveActiveResizeRotationDeg(path, [], 200)).toBe(0);
  });
});

describe('resolveCursorGesture', () => {
  it('is idle when far from any click and not moving', () => {
    const path: CursorPathPoint[] = [
      { atMs: 0, x: 0.1, y: 0.1 },
      { atMs: 5000, x: 0.1, y: 0.1 }
    ];
    expect(resolveCursorGesture(path, [], [], [], [], 1000)).toBe('idle');
  });

  it('is hover when stationary at (or near) a recorded click', () => {
    const path: CursorPathPoint[] = [
      { atMs: 0, x: 0.5, y: 0.5 },
      { atMs: 5000, x: 0.5, y: 0.5 }
    ];
    expect(resolveCursorGesture(path, CLICK_AT, [], [], [], 1200)).toBe('hover');
  });

  it('is resize while the tracked window is actually observed changing size, regardless of any click/cursor-movement data', () => {
    // resizePath entries mirror WindowBoundsPoller's own poll ticks (every
    // ~500ms) during a real, continuous window-edge drag -- a fact about the
    // window's own observed rect, not an inference from cursor position or
    // click state (clickPath is empty and the cursor isn't moving here at
    // all, yet this must still read as resize).
    const path: CursorPathPoint[] = [{ atMs: 0, x: 0.5, y: 0.5 }];
    const resizePath: WindowResizeSample[] = [{ atMs: 500 }, { atMs: 1000 }, { atMs: 1500 }];
    expect(resolveCursorGesture(path, [], resizePath, [], [], 1600)).toBe('resize');
  });

  it('is never resize -- no matter how far/fast the cursor moves or whether a click was just seen -- without an actual observed window-bounds change', () => {
    // Regression case for the bug this replaced: the old heuristic inferred
    // "is this a resize" from cursor movement plus real mousedown/mouseup
    // timestamps, which could never reliably tell a real window-edge drag
    // apart from any other held-and-moving gesture and regularly misfired.
    // With no WindowResizeSample data at all (e.g. a screen/full-screen
    // recording -- see window-bounds-poller.ts, which never populates this
    // for one), resize must never show, however drag-like the movement is.
    const path: CursorPathPoint[] = [
      { atMs: 1000, x: 0.5, y: 0.5 },
      { atMs: 1050, x: 0.95, y: 0.9 }
    ];
    expect(resolveCursorGesture(path, CLICK_AT, [], [], [], 1050)).not.toBe('resize');
  });

  it('stays resize for a short gap right after the last observed bounds change, then falls back once the window has genuinely stopped', () => {
    const path: CursorPathPoint[] = [{ atMs: 0, x: 0.5, y: 0.5 }];
    const resizePath: WindowResizeSample[] = [{ atMs: 1000 }];
    // Still within RESIZE_ACTIVE_WINDOW_MS of the last observed change.
    expect(resolveCursorGesture(path, [], resizePath, [], [], 1200)).toBe('resize');
    // Long after: the window has stopped changing, so no longer resize.
    expect(resolveCursorGesture(path, [], resizePath, [], [], 3000)).toBe('idle');
  });

  it('lingers as hover for the full grace window after any click, even resting somewhere unrelated to it, then reverts once the window passes', () => {
    // Stationary at the click from 0-1000, then moves away and settles
    // somewhere unrelated by 1200, well before the click's own 3.5s grace
    // window elapses.
    const path: CursorPathPoint[] = [
      { atMs: 0, x: 0.5, y: 0.5 },
      { atMs: 1000, x: 0.5, y: 0.5 },
      { atMs: 1200, x: 0.6, y: 0.5 },
      { atMs: 6000, x: 0.6, y: 0.5 }
    ];
    // Well after moving away, but still within the 3.5s grace window since
    // the click: still holding the hand icon.
    expect(resolveCursorGesture(path, CLICK_AT, [], [], [], 3000)).toBe('hover');
    // Past the grace window (click was at 1000, window is 3500ms), resting
    // somewhere unrelated to any click: idle.
    expect(resolveCursorGesture(path, CLICK_AT, [], [], [], 4600)).toBe('idle');
  });

  it('does not flip out of hover for a single-frame jitter blip well outside the click grace window', () => {
    // Regression case for a debounce that was dropped and silently restored
    // here: a real hand tremor can nudge the cursor's position just enough
    // to cross STILLNESS_EPS for one frame, then settle right back --
    // checking only the exact instant would flicker the icon off and back
    // on for that single frame. The click itself is at atMs 0, so by 4900
    // (well past HOVER_LINGER_MS's 3.5s) only the instantaneous
    // stationary-near-a-click condition can still be keeping this hover,
    // not the grace window.
    const clickAtOrigin: CursorPathPoint[] = [{ atMs: 0, x: 0.5, y: 0.5 }];
    const path: CursorPathPoint[] = [
      { atMs: 0, x: 0.5, y: 0.5 },
      { atMs: 4800, x: 0.5, y: 0.5 },
      { atMs: 4900, x: 0.5, y: 0.5051 }, // the jitter blip
      { atMs: 5100, x: 0.5, y: 0.5 }
    ];
    expect(resolveCursorGesture(path, clickAtOrigin, [], [], [], 4900)).toBe('hover');
  });
});

describe('resolveCursorGesture crosshair', () => {
  it('is crosshair while the OS is actually observed showing a crosshair cursor, regardless of click/movement data', () => {
    const path: CursorPathPoint[] = [{ atMs: 0, x: 0.5, y: 0.5 }];
    const crosshairPath: CursorCrosshairSample[] = [{ atMs: 500 }, { atMs: 550 }, { atMs: 600 }];
    expect(resolveCursorGesture(path, [], [], crosshairPath, [], 620)).toBe('crosshair');
  });

  it('stays crosshair for a short gap right after the last sighting, then falls back once it has genuinely stopped', () => {
    const path: CursorPathPoint[] = [{ atMs: 0, x: 0.5, y: 0.5 }];
    const crosshairPath: CursorCrosshairSample[] = [{ atMs: 1000 }];
    // Still within CROSSHAIR_ACTIVE_WINDOW_MS of the last sighting.
    expect(resolveCursorGesture(path, [], [], crosshairPath, [], 1200)).toBe('crosshair');
    // Long after: no longer active.
    expect(resolveCursorGesture(path, [], [], crosshairPath, [], 3000)).toBe('idle');
  });

  it('is never crosshair without an actual sighting, no matter how the cursor moves or clicks', () => {
    const path: CursorPathPoint[] = [
      { atMs: 1000, x: 0.5, y: 0.5 },
      { atMs: 1050, x: 0.95, y: 0.9 }
    ];
    expect(resolveCursorGesture(path, CLICK_AT, [], [], [], 1050)).not.toBe('crosshair');
  });

  it('takes precedence over hover, same as resize', () => {
    const path: CursorPathPoint[] = [{ atMs: 0, x: 0.5, y: 0.5 }];
    const crosshairPath: CursorCrosshairSample[] = [{ atMs: 500 }];
    // Stationary near CLICK_AT (hover-eligible) at the same instant a
    // crosshair sighting is active.
    expect(resolveCursorGesture(path, CLICK_AT, [], crosshairPath, [], 600)).toBe('crosshair');
  });

  it('takes second precedence behind resize (both are real facts, but resize is the more structural one)', () => {
    const path: CursorPathPoint[] = [{ atMs: 0, x: 0.5, y: 0.5 }];
    const resizePath: WindowResizeSample[] = [{ atMs: 500 }];
    const crosshairPath: CursorCrosshairSample[] = [{ atMs: 500 }];
    expect(resolveCursorGesture(path, [], resizePath, crosshairPath, [], 600)).toBe('resize');
  });

  it('is never gated by handGestureEnabled -- it always shows when active, regardless (there is no "crosshair" toggle)', () => {
    const path: CursorPathPoint[] = [{ atMs: 0, x: 0.5, y: 0.5 }];
    const crosshairPath: CursorCrosshairSample[] = [{ atMs: 500 }];
    expect(resolveCursorGesture(path, CLICK_AT, [], crosshairPath, [], 600, false)).toBe(
      'crosshair'
    );
  });
});

describe('resolveCursorGesture textSelect', () => {
  it('is textSelect while the OS is actually observed showing a text-select cursor, regardless of click/movement data', () => {
    const path: CursorPathPoint[] = [{ atMs: 0, x: 0.5, y: 0.5 }];
    const textSelectPath: CursorTextSelectSample[] = [{ atMs: 500 }, { atMs: 550 }, { atMs: 600 }];
    expect(resolveCursorGesture(path, [], [], [], textSelectPath, 620)).toBe('textSelect');
  });

  it('stays textSelect for a short gap right after the last sighting, then falls back once it has genuinely stopped', () => {
    const path: CursorPathPoint[] = [{ atMs: 0, x: 0.5, y: 0.5 }];
    const textSelectPath: CursorTextSelectSample[] = [{ atMs: 1000 }];
    expect(resolveCursorGesture(path, [], [], [], textSelectPath, 1200)).toBe('textSelect');
    expect(resolveCursorGesture(path, [], [], [], textSelectPath, 3000)).toBe('idle');
  });

  it('is never textSelect without an actual sighting, no matter how the cursor moves or clicks', () => {
    const path: CursorPathPoint[] = [
      { atMs: 1000, x: 0.5, y: 0.5 },
      { atMs: 1050, x: 0.95, y: 0.9 }
    ];
    expect(resolveCursorGesture(path, CLICK_AT, [], [], [], 1050)).not.toBe('textSelect');
  });

  it('takes precedence over hover', () => {
    const path: CursorPathPoint[] = [{ atMs: 0, x: 0.5, y: 0.5 }];
    const textSelectPath: CursorTextSelectSample[] = [{ atMs: 500 }];
    expect(resolveCursorGesture(path, CLICK_AT, [], [], textSelectPath, 600)).toBe('textSelect');
  });

  it('takes third precedence behind resize and crosshair (all three are real facts, ordered by how structural they are)', () => {
    const path: CursorPathPoint[] = [{ atMs: 0, x: 0.5, y: 0.5 }];
    const resizePath: WindowResizeSample[] = [{ atMs: 500 }];
    const crosshairPath: CursorCrosshairSample[] = [{ atMs: 500 }];
    const textSelectPath: CursorTextSelectSample[] = [{ atMs: 500 }];
    expect(resolveCursorGesture(path, [], resizePath, crosshairPath, textSelectPath, 600)).toBe(
      'resize'
    );
    expect(resolveCursorGesture(path, [], [], crosshairPath, textSelectPath, 600)).toBe(
      'crosshair'
    );
  });

  it('is never gated by handGestureEnabled -- it always shows when active, regardless (there is no "textSelect" toggle)', () => {
    const path: CursorPathPoint[] = [{ atMs: 0, x: 0.5, y: 0.5 }];
    const textSelectPath: CursorTextSelectSample[] = [{ atMs: 500 }];
    expect(resolveCursorGesture(path, CLICK_AT, [], [], textSelectPath, 600, false)).toBe(
      'textSelect'
    );
  });
});

describe('resolveCursorGesture handGestureEnabled', () => {
  it('never gates resize -- it always shows when active, regardless of handGestureEnabled (there is no "resize" toggle)', () => {
    const path: CursorPathPoint[] = [{ atMs: 0, x: 0.5, y: 0.5 }];
    const resizePath: WindowResizeSample[] = [{ atMs: 500 }];
    expect(resolveCursorGesture(path, CLICK_AT, resizePath, [], [], 600, false)).toBe('resize');
  });

  it('is idle (not hover) when handGestureEnabled is false, even though the cursor is stationary near a click', () => {
    const path: CursorPathPoint[] = [
      { atMs: 0, x: 0.5, y: 0.5 },
      { atMs: 5000, x: 0.5, y: 0.5 }
    ];
    expect(resolveCursorGesture(path, CLICK_AT, [], [], [], 1200, false)).toBe('idle');
  });

  it('defaults to hand gesture enabled when no argument is passed', () => {
    const path: CursorPathPoint[] = [
      { atMs: 0, x: 0.5, y: 0.5 },
      { atMs: 5000, x: 0.5, y: 0.5 }
    ];
    expect(resolveCursorGesture(path, CLICK_AT, [], [], [], 1200)).toBe('hover');
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
