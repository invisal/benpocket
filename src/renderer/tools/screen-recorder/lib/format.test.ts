import { describe, expect, it } from 'vitest';
import { formatElapsed } from './format';

describe('formatElapsed', () => {
  it('pads minutes and seconds to two digits', () => {
    expect(formatElapsed(0)).toBe('00:00');
    expect(formatElapsed(5)).toBe('00:05');
  });

  it('formats minutes and seconds together', () => {
    expect(formatElapsed(65)).toBe('01:05');
  });

  it('does not roll minutes over into hours', () => {
    expect(formatElapsed(3661)).toBe('61:01');
  });
});
