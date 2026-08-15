import { describe, expect, it } from 'vitest';
import { codecFallbackOrder } from './video-encoder';

describe('codecFallbackOrder', () => {
  it('appends h264 as a fallback for h265, on every platform', () => {
    expect(codecFallbackOrder('h265')).toEqual(['h265', 'h264']);
  });

  it('does not add a fallback for codecs that already have a working software path', () => {
    expect(codecFallbackOrder('h264')).toEqual(['h264']);
    expect(codecFallbackOrder('av1')).toEqual(['av1']);
  });
});
