import { describe, expect, it, vi } from 'vitest';
import type { Patch } from 'immer';
import { EMPTY_HISTORY, popRedo, popUndo, pushHistoryEntry } from './requestHistory';

function patch(path: (string | number)[], value: unknown): Patch {
  return { op: 'replace', path, value };
}

describe('pushHistoryEntry', () => {
  it('does nothing for an empty patch set', () => {
    expect(pushHistoryEntry(EMPTY_HISTORY, [], [])).toBe(EMPTY_HISTORY);
  });

  it('appends a new entry and clears future', () => {
    const withRedo = { past: [], future: [{ patches: [], inversePatches: [], timestamp: 0 }] };
    const next = pushHistoryEntry(withRedo, [patch(['url'], 'b')], [patch(['url'], 'a')]);
    expect(next.past).toHaveLength(1);
    expect(next.future).toHaveLength(0);
  });

  it('coalesces consecutive edits to the same field within the coalesce window', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(0);
      let state = pushHistoryEntry(EMPTY_HISTORY, [patch(['url'], 'a')], [patch(['url'], '')]);
      vi.setSystemTime(300);
      state = pushHistoryEntry(state, [patch(['url'], 'ab')], [patch(['url'], 'a')]);
      vi.setSystemTime(500);
      state = pushHistoryEntry(state, [patch(['url'], 'abc')], [patch(['url'], 'ab')]);

      expect(state.past).toHaveLength(1);
      // Keeps the very first inverse (undo restores pre-burst state) and the latest patch.
      expect(state.past[0].inversePatches).toEqual([patch(['url'], '')]);
      expect(state.past[0].patches).toEqual([patch(['url'], 'abc')]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not coalesce edits to a different field', () => {
    let state = pushHistoryEntry(EMPTY_HISTORY, [patch(['url'], 'a')], [patch(['url'], '')]);
    state = pushHistoryEntry(state, [patch(['method'], 'POST')], [patch(['method'], 'GET')]);
    expect(state.past).toHaveLength(2);
  });

  it('does not coalesce edits outside the coalesce window', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(0);
      let state = pushHistoryEntry(EMPTY_HISTORY, [patch(['url'], 'a')], [patch(['url'], '')]);
      vi.setSystemTime(5000);
      state = pushHistoryEntry(state, [patch(['url'], 'ab')], [patch(['url'], 'a')]);
      expect(state.past).toHaveLength(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('caps the stack at 100 entries', () => {
    vi.useFakeTimers();
    try {
      let state = EMPTY_HISTORY;
      for (let i = 0; i < 105; i++) {
        vi.setSystemTime(i * 1000); // beyond the coalesce window each time
        state = pushHistoryEntry(
          state,
          [patch(['method'], String(i))],
          [patch(['method'], String(i - 1))]
        );
      }
      expect(state.past).toHaveLength(100);
      expect(state.past[0].patches).toEqual([patch(['method'], '5')]);
      expect(state.past[99].patches).toEqual([patch(['method'], '104')]);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('popUndo / popRedo', () => {
  it('returns null when there is nothing to undo or redo', () => {
    expect(popUndo(EMPTY_HISTORY)).toBeNull();
    expect(popRedo(EMPTY_HISTORY)).toBeNull();
  });

  it('moves the most recent past entry into future on undo', () => {
    const state = pushHistoryEntry(EMPTY_HISTORY, [patch(['url'], 'a')], [patch(['url'], '')]);
    const result = popUndo(state);
    expect(result).not.toBeNull();
    expect(result!.next.past).toHaveLength(0);
    expect(result!.next.future).toHaveLength(1);
    expect(result!.entry.inversePatches).toEqual([patch(['url'], '')]);
  });

  it('round-trips undo then redo back to the same history shape', () => {
    let state = pushHistoryEntry(EMPTY_HISTORY, [patch(['url'], 'a')], [patch(['url'], '')]);
    const undone = popUndo(state)!;
    state = undone.next;
    const redone = popRedo(state)!;
    state = redone.next;
    expect(state.past).toHaveLength(1);
    expect(state.future).toHaveLength(0);
    expect(redone.entry.patches).toEqual([patch(['url'], 'a')]);
  });
});
