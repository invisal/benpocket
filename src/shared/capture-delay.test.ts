import { describe, expect, it } from 'vitest';
import { captureDelayLabel, normalizeCaptureDelay, runCaptureCountdown } from './capture-delay';

describe('normalizeCaptureDelay', () => {
  it('accepts 3, 5, and 10 and treats everything else as off', () => {
    expect(normalizeCaptureDelay(3)).toBe(3);
    expect(normalizeCaptureDelay(5)).toBe(5);
    expect(normalizeCaptureDelay(10)).toBe(10);
    expect(normalizeCaptureDelay(0)).toBe(0);
    expect(normalizeCaptureDelay(1)).toBe(0);
    expect(normalizeCaptureDelay(undefined)).toBe(0);
    expect(normalizeCaptureDelay('5')).toBe(0);
  });
});

describe('captureDelayLabel', () => {
  it('labels off vs seconds', () => {
    expect(captureDelayLabel(0)).toBe('Off');
    expect(captureDelayLabel(5)).toBe('5s');
  });
});

describe('runCaptureCountdown', () => {
  it('skips ticking when delay is off', async () => {
    const ticks: number[] = [];
    await expect(runCaptureCountdown(0, (n) => ticks.push(n))).resolves.toBe(true);
    expect(ticks).toEqual([]);
  });

  it('ticks remaining seconds then resolves true', async () => {
    const ticks: number[] = [];
    await expect(runCaptureCountdown(3, (n) => ticks.push(n), { intervalMs: 0 })).resolves.toBe(
      true
    );
    expect(ticks).toEqual([3, 2, 1]);
  });

  it('resolves false when aborted before starting', async () => {
    const signal = AbortSignal.abort();
    const ticks: number[] = [];
    await expect(runCaptureCountdown(5, (n) => ticks.push(n), { signal })).resolves.toBe(false);
    expect(ticks).toEqual([]);
  });

  it('resolves false when aborted mid-countdown', async () => {
    const controller = new AbortController();
    const ticks: number[] = [];
    const done = runCaptureCountdown(
      10,
      (n) => {
        ticks.push(n);
        if (n === 10) controller.abort();
      },
      { signal: controller.signal, intervalMs: 0 }
    );
    await expect(done).resolves.toBe(false);
    expect(ticks).toEqual([10]);
  });
});
