import { describe, expect, it } from 'vitest';
import { DEFAULT_ZOOM_DURATION_MS } from '@shared/constants';
import { generateAutoZoomKeyframes } from './auto-zoom-engine';

function click(atMs: number) {
  return { atMs, x: 0.5, y: 0.5 };
}

describe('generateAutoZoomKeyframes', () => {
  it('returns nothing for no clicks', () => {
    expect(generateAutoZoomKeyframes([])).toEqual([]);
  });

  it('gives a lone click its own default-duration window', () => {
    const [kf] = generateAutoZoomKeyframes([click(0)]);
    expect(kf.atMs).toBe(0);
    expect(kf.durationMs).toBe(DEFAULT_ZOOM_DURATION_MS);
  });

  it('starts a new keyframe once the gap since the last click exceeds the threshold', () => {
    const keyframes = generateAutoZoomKeyframes([click(0), click(DEFAULT_ZOOM_DURATION_MS + 1)]);
    expect(keyframes).toHaveLength(2);
  });

  it('merges a rapid click-move-click into a single non-overlapping keyframe', () => {
    // The exact reported bug: click somewhere, then quickly move and click
    // elsewhere -- both clicks fall inside the same zoom window and must
    // collapse into one keyframe, not two overlapping ones.
    const keyframes = generateAutoZoomKeyframes([click(0), click(200)]);
    expect(keyframes).toHaveLength(1);
    expect(keyframes[0].atMs).toBe(0);
    expect(keyframes[0].durationMs).toBe(200 + DEFAULT_ZOOM_DURATION_MS);
  });

  it('keeps merging a chain of clicks each within the threshold of the previous one, without producing an overlap once the cluster outgrows the original window', () => {
    // Regression for the actual bug: click 1 at 0, click 2 at 2000 (merges,
    // extending the window to end at 4500), click 3 at 4000 -- only 2000ms
    // after click 2, so it must still merge even though it's more than
    // MIN_GAP_MS (2500ms) after the *cluster's* own start (atMs=0).
    const keyframes = generateAutoZoomKeyframes([click(0), click(2000), click(4000)]);
    expect(keyframes).toHaveLength(1);
    expect(keyframes[0].atMs).toBe(0);
    expect(keyframes[0].durationMs).toBe(4000 + DEFAULT_ZOOM_DURATION_MS);
  });

  it('never produces two keyframes whose ranges overlap', () => {
    const keyframes = generateAutoZoomKeyframes([
      click(0),
      click(1500),
      click(2600),
      click(9000),
      click(9200)
    ]);
    for (let i = 1; i < keyframes.length; i++) {
      const prevEnd = keyframes[i - 1].atMs + keyframes[i - 1].durationMs;
      expect(keyframes[i].atMs).toBeGreaterThanOrEqual(prevEnd);
    }
  });

  it('sorts out-of-order click samples before generating', () => {
    const keyframes = generateAutoZoomKeyframes([click(200), click(0)]);
    expect(keyframes).toHaveLength(1);
    expect(keyframes[0].atMs).toBe(0);
  });
});
