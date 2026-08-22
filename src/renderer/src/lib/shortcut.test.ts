import { describe, expect, it } from 'vitest';
import { parseShortcut } from './shortcut';

describe('parseShortcut', () => {
  it('recognizes real Electron accelerator modifier spellings', () => {
    // Regression: this used to only recognize its own hand-authored shorthand
    // tokens ('mod'/'ctrl'/...), so a real accelerator's "CommandOrControl"
    // token was silently dropped and only "Shift+5" was ever detected.
    expect(parseShortcut('CommandOrControl+Shift+5')).toEqual({
      modifiers: ['shift', 'mod'],
      key: '5'
    });
  });

  it('still recognizes the hand-authored shorthand vocabulary', () => {
    expect(parseShortcut('mod+c')).toEqual({ modifiers: ['mod'], key: 'c' });
  });

  it('treats Mac Control as distinct from the cross-platform mod modifier', () => {
    expect(parseShortcut('Control+CommandOrControl+r')).toEqual({
      modifiers: ['ctrl', 'mod'],
      key: 'r'
    });
  });

  it('is a no-op for a key with no modifiers', () => {
    expect(parseShortcut('delete')).toEqual({ modifiers: [], key: 'delete' });
  });
});
