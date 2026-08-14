import { describe, expect, it } from 'vitest';
import { usesOsCapturePicker } from './uses-os-capture-picker';

describe('usesOsCapturePicker', () => {
  it('is true only on Linux Wayland, where sources cannot be listed', () => {
    expect(usesOsCapturePicker('linux', { WAYLAND_DISPLAY: 'wayland-0' })).toBe(true);
    expect(usesOsCapturePicker('linux', { XDG_SESSION_TYPE: 'wayland' })).toBe(true);
    expect(usesOsCapturePicker('linux', { XDG_SESSION_TYPE: 'x11' })).toBe(false);
    expect(usesOsCapturePicker('darwin')).toBe(false);
    expect(usesOsCapturePicker('win32')).toBe(false);
  });
});
