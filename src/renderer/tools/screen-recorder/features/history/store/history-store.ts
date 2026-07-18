import { create } from 'zustand';

/**
 * One entry in the undo/redo stack: a snapshot of every registered store's
 * undoable slice, keyed by the same string each store registers itself
 * under (see `withHistory`). Snapshotting the whole document at once (not
 * per-store diffs) keeps cross-store ordering trivial -- undo always
 * restores everything to exactly how it looked at that point in time,
 * regardless of which panel made the change.
 */
type HistorySnapshot = Record<string, unknown>;

interface HistorySlice {
  getSnapshot: () => unknown;
  restore: (value: unknown) => void;
}

/** Caps memory growth for very long editing sessions. */
const MAX_HISTORY_ENTRIES = 100;

const registry = new Map<string, HistorySlice>();

let isRestoring = false;
/**
 * Depth (not a boolean) so a gesture that itself triggers another
 * `beginGesture`/`endGesture` pair -- unlikely, but cheap to make safe --
 * doesn't close prematurely. Only 0 <-> >0 transitions matter.
 */
let gestureDepth = 0;
/** Whether the *current* gesture has already committed its one entry. */
let gestureEntryCommitted = false;

function captureSnapshot(): HistorySnapshot {
  const snapshot: HistorySnapshot = {};
  for (const [key, slice] of registry) snapshot[key] = slice.getSnapshot();
  return snapshot;
}

/**
 * Exposed so `withHistory` can grab the pre-change snapshot itself, before
 * it knows yet whether this particular write is even worth recording (see
 * `recordChange`'s doc comment for why that check matters).
 */
export function captureHistorySnapshot(): HistorySnapshot {
  return captureSnapshot();
}

function restoreSnapshot(snapshot: HistorySnapshot): void {
  isRestoring = true;
  try {
    for (const [key, slice] of registry) {
      if (key in snapshot) slice.restore(snapshot[key]);
    }
  } finally {
    isRestoring = false;
  }
}

/**
 * Brackets a continuous drag gesture (trim-handle drag, slider scrub, crop
 * rect drag, ...) so however many individual `set` calls it makes along the
 * way -- one per pointermove -- collapse into a single undo step, the state
 * from right before the drag started. Every `beginGesture` must be paired
 * with an `endGesture` once the drag ends (mirror the pointerdown/pointerup
 * pair the caller already has for the drag itself).
 *
 * Changes made *outside* a gesture (a button click, picking a preset, a
 * single committed edit) are never merged with each other, regardless of
 * how close together they happen -- each is always its own undo step. This
 * is deliberate: two distinct user actions performed quickly back-to-back
 * (e.g. resize a zoom keyframe, then delete it) must still undo one at a
 * time, not jump both at once.
 */
export function beginGesture(): void {
  gestureDepth++;
}

export function endGesture(): void {
  gestureDepth = Math.max(0, gestureDepth - 1);
  if (gestureDepth === 0) gestureEntryCommitted = false;
}

/**
 * Registers a store's undoable slice. Called once per store, at module load
 * (see `withHistory`) -- not tied to React lifecycle, since undo must work
 * across the whole app session regardless of which panels are mounted.
 */
export function registerHistorySlice(
  key: string,
  getSnapshot: () => unknown,
  restore: (value: unknown) => void
): void {
  registry.set(key, { getSnapshot, restore });
}

/** True while `undo`/`redo` is replaying a snapshot -- lets `withHistory` skip re-recording those writes. */
export function isApplyingHistory(): boolean {
  return isRestoring;
}

/**
 * Called by `withHistory` after it's confirmed a store's write actually
 * changed that store's own undoable slice -- NOT on every `set` call
 * regardless of what it touched. That distinction matters: stores also
 * carry non-undoable UI state through the exact same `set` (timeline's
 * `playheadMs`, for instance, updates ~60x/second while the preview plays).
 * Recording those would flood `past` with no-op duplicates that silently
 * evict real edits once the cap is hit -- undo would then restore a
 * snapshot indistinguishable from the current state, i.e. visibly do
 * nothing. `beforeSnapshot` is the cross-store snapshot captured right
 * before the change, by whichever store called this.
 *
 * Outside a gesture, every call commits its own undo step immediately.
 * Inside one (between `beginGesture`/`endGesture`), only the first call
 * commits -- the rest are absorbed into that same step.
 */
export function recordChange(beforeSnapshot: HistorySnapshot): void {
  if (isRestoring) return;
  if (gestureDepth > 0) {
    if (gestureEntryCommitted) return;
    gestureEntryCommitted = true;
  }
  const past = [...useHistoryStore.getState().past, beforeSnapshot].slice(-MAX_HISTORY_ENTRIES);
  useHistoryStore.setState({ past, future: [] });
}

interface HistoryStoreState {
  past: HistorySnapshot[];
  future: HistorySnapshot[];
  undo: () => void;
  redo: () => void;
}

/**
 * Cross-store undo/redo for the editor. Individual feature stores (timeline,
 * zoom, background, ...) don't know this exists -- they opt in by wrapping
 * their creator in `withHistory`, which registers their undoable slice here
 * and routes their writes through `recordChange`. Components only need this
 * store for the `past`/`future` lengths (to enable/disable buttons) and the
 * `undo`/`redo` actions themselves.
 */
export const useHistoryStore = create<HistoryStoreState>((set, get) => ({
  past: [],
  future: [],
  undo: () => {
    // Defensive: a gesture that never got its matching `endGesture` (a drag
    // component unmounting mid-drag, say) would otherwise wedge future
    // changes into silently not recording at all.
    gestureDepth = 0;
    gestureEntryCommitted = false;
    const { past, future } = get();
    if (past.length === 0) return;
    const previous = past[past.length - 1];
    const current = captureSnapshot();
    restoreSnapshot(previous);
    set({ past: past.slice(0, -1), future: [...future, current] });
  },
  redo: () => {
    gestureDepth = 0;
    gestureEntryCommitted = false;
    const { past, future } = get();
    if (future.length === 0) return;
    const next = future[future.length - 1];
    const current = captureSnapshot();
    restoreSnapshot(next);
    set({ future: future.slice(0, -1), past: [...past, current] });
  }
}));

/**
 * Clears the undo/redo stack -- call this at a session boundary (a
 * *different* recording loading into the editor, not just a re-render of
 * the same one) so a fresh session can't be undone back into whatever the
 * previous recording's edits looked like. Doesn't touch the content stores
 * themselves; callers are expected to (re)initialize those separately, e.g.
 * `EditorPage`'s `initializeFromDuration` call.
 */
export function resetHistory(): void {
  gestureDepth = 0;
  gestureEntryCommitted = false;
  useHistoryStore.setState({ past: [], future: [] });
}
