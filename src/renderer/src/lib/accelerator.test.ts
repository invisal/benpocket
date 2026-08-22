import { describe, expect, it } from 'vitest';
import { normalizeKey } from './accelerator';

function fakeEvent(overrides: Partial<KeyboardEvent>): KeyboardEvent {
  return { key: '', code: '', ...overrides } as KeyboardEvent;
}

describe('normalizeKey', () => {
  it('uses the physical key, not the Shift-produced character', () => {
    // Regression: Ctrl+Shift+5 read `e.key` ("%", what Shift+5 produces on a
    // US layout) instead of the physical key, so the capture UI showed "%"
    // instead of "5".
    expect(normalizeKey(fakeEvent({ key: '%', code: 'Digit5' }))).toBe('5');
    expect(normalizeKey(fakeEvent({ key: '_', code: 'Minus' }))).toBe('-');
  });

  it('uppercases a plain letter key', () => {
    expect(normalizeKey(fakeEvent({ key: 'r', code: 'KeyR' }))).toBe('R');
  });

  it('ignores a bare modifier press', () => {
    expect(normalizeKey(fakeEvent({ key: 'Control', code: 'ControlLeft' }))).toBeNull();
    expect(normalizeKey(fakeEvent({ key: 'Shift', code: 'ShiftLeft' }))).toBeNull();
  });

  it('reserves Escape for canceling capture', () => {
    expect(normalizeKey(fakeEvent({ key: 'Escape', code: 'Escape' }))).toBeNull();
  });

  it('maps named keys to their Electron accelerator spelling', () => {
    expect(normalizeKey(fakeEvent({ key: 'Enter', code: 'Enter' }))).toBe('Return');
    expect(normalizeKey(fakeEvent({ key: 'ArrowUp', code: 'ArrowUp' }))).toBe('Up');
  });
});
