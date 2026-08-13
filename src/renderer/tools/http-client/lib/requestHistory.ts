import type { Patch } from 'immer';

export interface HistoryEntry {
  patches: Patch[];
  inversePatches: Patch[];
  timestamp: number;
}

export interface RequestHistoryState {
  past: HistoryEntry[];
  future: HistoryEntry[];
}

export const EMPTY_HISTORY: RequestHistoryState = { past: [], future: [] };

const MAX_HISTORY_ENTRIES = 100;
const COALESCE_WINDOW_MS = 700;

function samePaths(a: Patch[], b: Patch[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((patch, i) => patch.path.join('.') === b[i].path.join('.'));
}

/**
 * Appends a change to history, merging into the previous entry when it touches the exact same
 * field(s) within COALESCE_WINDOW_MS - so a burst of keystrokes in one text field (URL, a
 * header's value, ...) becomes a single undo step instead of one per keystroke. The merged
 * entry keeps the latest `patches` (the newest value) but the *original* `inversePatches` (the
 * value before the burst started), so one undo restores pre-burst state in one step.
 */
export function pushHistoryEntry(
  state: RequestHistoryState,
  patches: Patch[],
  inversePatches: Patch[]
): RequestHistoryState {
  if (patches.length === 0) return state;
  const now = Date.now();
  const last = state.past[state.past.length - 1];
  if (last && now - last.timestamp < COALESCE_WINDOW_MS && samePaths(patches, last.patches)) {
    const merged: HistoryEntry = { patches, inversePatches: last.inversePatches, timestamp: now };
    return { past: [...state.past.slice(0, -1), merged], future: [] };
  }
  const past = [...state.past, { patches, inversePatches, timestamp: now }];
  return {
    past: past.length > MAX_HISTORY_ENTRIES ? past.slice(past.length - MAX_HISTORY_ENTRIES) : past,
    future: []
  };
}

export function popUndo(
  state: RequestHistoryState
): { entry: HistoryEntry; next: RequestHistoryState } | null {
  const entry = state.past[state.past.length - 1];
  if (!entry) return null;
  return { entry, next: { past: state.past.slice(0, -1), future: [entry, ...state.future] } };
}

export function popRedo(
  state: RequestHistoryState
): { entry: HistoryEntry; next: RequestHistoryState } | null {
  const entry = state.future[0];
  if (!entry) return null;
  return { entry, next: { past: [...state.past, entry], future: state.future.slice(1) } };
}
