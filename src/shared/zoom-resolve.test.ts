import { describe, expect, it } from 'vitest';
import { resolveZoom } from './zoom-resolve';
import type { ZoomKeyframe } from '@screen-recorder/types/timeline';

function keyframe(overrides: Partial<ZoomKeyframe> = {}): ZoomKeyframe {
  return {
    id: 'kf',
    atMs: 0,
    durationMs: 1000,
    depth: 3,
    easing: 'linear',
    position: { x: 0.5, y: 0.5 },
    // 0 collapses the ramp-in/out (see resolveZoom's `rampMs`), so `envelope`
    // is 1 for the whole keyframe -- keeps these cases about the shift
    // clamp itself, not the ramp curve.
    holdTransitionMs: 0,
    enabled: true,
    ...overrides
  };
}

describe('resolveZoom', () => {
  it('does not shift when the focal point is already centered', () => {
    const { shift } = resolveZoom(500, [keyframe({ position: { x: 0.5, y: 0.5 } })]);
    expect(shift).toEqual({ x: 0, y: 0 });
  });

  it('clamps shift to zero when the focal point sits exactly on an edge', () => {
    // Scaling around a point already on the edge keeps that edge pinned at
    // the boundary -- any further shift toward center would pull it inward,
    // exposing empty space past that edge (see clampShiftAxis's doc).
    // `toBeCloseTo`, not `toBe`/`toEqual` -- the clamp math can land on
    // `-0` here (e.g. `-(1 - 1) * depth`), numerically equal to `0` but not
    // `Object.is`-identical to it.
    const { shift } = resolveZoom(500, [keyframe({ position: { x: 0, y: 1 }, depth: 3 })]);
    expect(shift.x).toBeCloseTo(0);
    expect(shift.y).toBeCloseTo(0);
  });

  it('clamps a near-edge focal point to a smaller shift than the raw formula would give', () => {
    // Raw shift would be 0.5 - 0.1 = 0.4, but at depth 2 the covering
    // constraint caps it at focal * (depth - 1) = 0.1 * 1 = 0.1.
    const { shift } = resolveZoom(500, [
      keyframe({ position: { x: 0.1, y: 0.5 }, depth: 2, durationMs: 1000 })
    ]);
    expect(shift.x).toBeCloseTo(0.1);
    expect(shift.y).toBe(0);
  });

  it('keeps the content covering its own [0,1] bounds after clamping, for a range of edge-leaning focal points and depths', () => {
    for (const focal of [0, 0.1, 0.3, 0.7, 0.9, 1]) {
      for (const depth of [1.5, 2, 3, 5]) {
        const { shift } = resolveZoom(500, [
          keyframe({ position: { x: focal, y: focal }, depth, durationMs: 1000 })
        ]);
        const leftEdge = focal * (1 - depth) + shift.x;
        const rightEdge = focal + depth * (1 - focal) + shift.x;
        expect(leftEdge).toBeLessThanOrEqual(1e-9);
        expect(rightEdge).toBeGreaterThanOrEqual(1 - 1e-9);
      }
    }
  });
});
