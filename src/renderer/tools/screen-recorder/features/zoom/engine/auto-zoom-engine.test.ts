import { describe, expect, it } from 'vitest';
import { generateAutoZoomKeyframes, type CursorSample } from './auto-zoom-engine';

function click(atMs: number, x: number, y: number): CursorSample {
  return { atMs, x, y };
}

describe('generateAutoZoomKeyframes', () => {
  it('returns nothing for no clicks', () => {
    expect(generateAutoZoomKeyframes([])).toEqual([]);
  });

  it('merges clicks in the same area within the idle timeout into one keyframe', () => {
    const keyframes = generateAutoZoomKeyframes([
      click(0, 0.5, 0.5),
      click(1000, 0.52, 0.51),
      click(2000, 0.5, 0.53)
    ]);
    expect(keyframes).toHaveLength(1);
  });

  it('starts a new keyframe once the previously kept click has gone idle (>= 5s)', () => {
    const keyframes = generateAutoZoomKeyframes([click(0, 0.5, 0.5), click(5000, 0.5, 0.5)]);
    expect(keyframes).toHaveLength(2);
  });

  it('starts a new keyframe for a click in a different area, even well inside the idle timeout', () => {
    const keyframes = generateAutoZoomKeyframes([click(0, 0.1, 0.1), click(500, 0.9, 0.9)]);
    expect(keyframes).toHaveLength(2);
  });

  it('keeps holding through repeated nearby clicks as long as each stays under the idle timeout', () => {
    const keyframes = generateAutoZoomKeyframes([
      click(0, 0.5, 0.5),
      click(4900, 0.51, 0.5),
      click(9800, 0.5, 0.51),
      click(14700, 0.52, 0.5)
    ]);
    expect(keyframes).toHaveLength(1);
    expect(keyframes[0].atMs).toBe(0);
  });
});
