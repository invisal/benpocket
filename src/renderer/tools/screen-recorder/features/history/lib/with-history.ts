import type { StateCreator } from 'zustand';
import {
  captureHistorySnapshot,
  isApplyingHistory,
  recordChange,
  registerHistorySlice
} from '../store/history-store';

/** Shallow key-by-key comparison of two `partialize` outputs -- cheap, and correct as long as every action updates a changed field with a new reference (true everywhere in this codebase; nothing mutates arrays/objects in place). */
function sliceChanged(before: Record<string, unknown>, after: Record<string, unknown>): boolean {
  const keys = Object.keys(before);
  return (
    keys.length !== Object.keys(after).length || keys.some((k) => !Object.is(before[k], after[k]))
  );
}

/**
 * Wraps a Zustand store creator so state changes that touch its undoable
 * slice become one entry in the shared cross-store undo/redo stack in
 * `history-store.ts`.
 *
 * `partialize` picks exactly which fields count as undoable content --
 * leave out transient UI state (selection ids, "armed"/interaction-mode
 * flags, drag-in-progress state) so undo only ever touches the document,
 * never fights the UI by snapping selection or tool mode back too. That
 * exclusion isn't just cosmetic: a store's `set` is also used for its
 * non-undoable fields (timeline's `playheadMs` updates ~60x/second during
 * playback), so every write is compared against `partialize`'s before/after
 * and only recorded if it actually changed -- otherwise those writes would
 * flood `past` with no-op entries that evict real edits once the cap hits.
 *
 * Usage: `create<State>(withHistory('background', (s) => ({ ...content
 * fields }), (set, get) => ({ ...the store as usual })))`.
 */
export function withHistory<T extends object>(
  key: string,
  partialize: (state: T) => Partial<T>,
  config: StateCreator<T, [], []>
): StateCreator<T, [], []> {
  return (set, get, api) => {
    // zustand's `setState` is overloaded (partial-merge vs. full-replace);
    // this wrapper only changes *when* a write is recorded, never its
    // shape, so forwarding the arguments through untyped and casting back
    // to the real overloaded signature is safe.
    const wrappedSet = ((partial: unknown, replace?: boolean) => {
      if (isApplyingHistory()) {
        (set as (partial: unknown, replace?: boolean) => void)(partial, replace);
        return;
      }
      const globalBefore = captureHistorySnapshot();
      const sliceBefore = partialize(get());
      (set as (partial: unknown, replace?: boolean) => void)(partial, replace);
      const sliceAfter = partialize(get());
      if (sliceChanged(sliceBefore, sliceAfter)) recordChange(globalBefore);
    }) as typeof set;

    registerHistorySlice(
      key,
      () => partialize(get()),
      (value) => set(value as Partial<T>, false)
    );

    return config(wrappedSet, get, api);
  };
}
