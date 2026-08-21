import { describe, expect, it } from 'vitest';
import {
  clickElapsedSecondsInRange,
  intensityToGain,
  mixBurstInto,
  renderClickOverlay,
  scaleBurst
} from './click-sound';
import type { CursorPathPoint } from './cursor-path';

describe('intensityToGain', () => {
  it('maps the 0-5 intensity range onto 0-1', () => {
    expect(intensityToGain(0)).toBe(0);
    expect(intensityToGain(2.5)).toBeCloseTo(0.5);
    expect(intensityToGain(5)).toBe(1);
  });

  it('clamps outside the 0-5 range', () => {
    expect(intensityToGain(-1)).toBe(0);
    expect(intensityToGain(8)).toBe(1);
  });
});

describe('scaleBurst', () => {
  it('scales every sample by gain', () => {
    const burst = new Float32Array([0.2, -0.4, 1]);
    const scaled = scaleBurst(burst, 0.5);
    Array.from(scaled).forEach((sample, i) => expect(sample).toBeCloseTo([0.1, -0.2, 0.5][i]));
  });

  it('returns the same array instance at gain 1 (no-op)', () => {
    const burst = new Float32Array([0.2, -0.4]);
    expect(scaleBurst(burst, 1)).toBe(burst);
  });
});

describe('mixBurstInto', () => {
  it('adds the burst into the target at the given offset', () => {
    const target = new Float32Array(10);
    const burst = new Float32Array([0.5, 0.25]);
    mixBurstInto(target, burst, 3);
    expect(Array.from(target)).toEqual([0, 0, 0, 0.5, 0.25, 0, 0, 0, 0, 0]);
  });

  it('clips a burst that starts before the target (negative offset)', () => {
    const target = new Float32Array(4);
    const burst = new Float32Array([0.1, 0.2, 0.3]);
    mixBurstInto(target, burst, -1);
    Array.from(target).forEach((sample, i) => expect(sample).toBeCloseTo([0.2, 0.3, 0, 0][i]));
  });

  it('clips a burst that extends past the target end', () => {
    const target = new Float32Array(3);
    const burst = new Float32Array([0.1, 0.2, 0.3, 0.4]);
    mixBurstInto(target, burst, 1);
    Array.from(target).forEach((sample, i) => expect(sample).toBeCloseTo([0, 0.1, 0.2][i]));
  });

  it('clamps overlapping bursts instead of wrapping past full scale', () => {
    const target = new Float32Array([0.8]);
    const burst = new Float32Array([0.8]);
    mixBurstInto(target, burst, 0);
    expect(target[0]).toBe(1);
  });
});

describe('clickElapsedSecondsInRange', () => {
  const clicks: CursorPathPoint[] = [
    { atMs: 500, x: 0, y: 0 },
    { atMs: 1000, x: 0, y: 0 },
    { atMs: 2500, x: 0, y: 0 }
  ];

  it('selects only clicks within [rangeStartMs, rangeEndMs) and offsets them relative to the range start', () => {
    expect(clickElapsedSecondsInRange(clicks, 1000, 2000)).toEqual([0]);
  });

  it('excludes the range end boundary itself', () => {
    expect(clickElapsedSecondsInRange(clicks, 0, 1000)).toEqual([0.5]);
  });

  it('divides elapsed time by speed', () => {
    expect(clickElapsedSecondsInRange(clicks, 0, 3000, 2)).toEqual([0.25, 0.5, 1.25]);
  });
});

describe('renderClickOverlay', () => {
  const burst = new Float32Array([1, 1, 1]);

  it('is all-zero silence with no clicks', () => {
    const overlay = renderClickOverlay([], 100, 48000, burst);
    expect(overlay.every((s) => s === 0)).toBe(true);
    expect(overlay.length).toBe(100);
  });

  it('places the burst at the right sample offset for each click time', () => {
    const overlay = renderClickOverlay([0.001], 10, 1000, burst);
    // 0.001s * 1000Hz = 1 frame in.
    expect(Array.from(overlay)).toEqual([0, 1, 1, 1, 0, 0, 0, 0, 0, 0]);
  });

  it('sums overlapping clicks rather than overwriting (short of the clamp ceiling)', () => {
    const quietBurst = new Float32Array([0.5, 0.5, 0.5]);
    const overlay = renderClickOverlay([0, 0.001], 10, 1000, quietBurst);
    expect(Array.from(overlay)).toEqual([0.5, 1, 1, 0.5, 0, 0, 0, 0, 0, 0]);
  });
});
