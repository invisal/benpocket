import { create } from 'zustand';
import { imageUnit, type Rect } from '../lib/flatten';
import type { CaptureAnnotation, EditorTool } from '../types/editor';

export const EDITOR_COLORS = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#ffffff', '#000000'];

export const STROKE_TIERS = [
  { label: 'Thin', value: 2 },
  { label: 'Medium', value: 4 },
  { label: 'Thick', value: 7 }
];

export const FONT_TIERS = [
  { label: 'Small text', value: 16 },
  { label: 'Medium text', value: 24 },
  { label: 'Large text', value: 36 }
];

/** Blur radius tiers in `unit`s (multiplied by `unit` into image px). */
export const BLUR_TIERS = [
  { label: 'Light blur', value: 4 },
  { label: 'Medium blur', value: 8 },
  { label: 'Strong blur', value: 16 }
];

/** Max corner radius as a multiple of `unit` (i.e. ~6.4% of image width). */
export const MAX_CORNER_RADIUS_UNITS = 64;

interface EditorState {
  imageWidth: number;
  imageHeight: number;
  /**
   * Sizing unit so defaults look the same regardless of capture resolution:
   * a 4K screenshot needs ~4x thicker strokes/text than a 960px window to
   * read identically. 1 unit = imageWidth / 1000 (min 1).
   */
  unit: number;
  annotations: CaptureAnnotation[];
  /**
   * Non-destructive crop in source-image px, or null for the full image.
   * Annotations always stay in source-image coordinates; the stage viewport
   * and the export shift by the crop origin instead of rebasing them.
   */
  crop: Rect | null;
  /** Baked into the exported PNG as a rounded-rect clip. In image px. */
  cornerRadius: number;
  tool: EditorTool;
  selectedId: string | null;
  /** Text annotation currently showing its inline text input. */
  editingId: string | null;
  color: string;
  /** Stroke width in units (multiplied by `unit` at creation time). */
  strokeTier: number;
  /** Text size in units (multiplied by `unit` at creation time). */
  fontTier: number;
  /** Blur radius in units (multiplied by `unit` at creation time). */
  blurTier: number;
  // ponytail: undo covers annotations + crop only — cornerRadius is a slider
  // the user can just drag back; tracking it would spam the stack on every
  // input event. Upgrade path: begin/end gesture around slider drags.
  past: Snapshot[];
  future: Snapshot[];
  init: (imageWidth: number, imageHeight: number) => void;
  reset: () => void;
  setTool: (tool: EditorTool) => void;
  /** Setters below update the default for new annotations and patch the target annotation (explicit `id`, else the selection) when the property applies to its kind. */
  setColor: (color: string, id?: string) => void;
  setStrokeTier: (tier: number, id?: string) => void;
  setFontTier: (tier: number, id?: string) => void;
  setBlurTier: (tier: number, id?: string) => void;
  setCornerRadius: (radius: number) => void;
  setSelectedId: (id: string | null) => void;
  setEditingId: (id: string | null) => void;
  addAnnotation: (annotation: CaptureAnnotation) => void;
  /** Undo-tracked change — for discrete edits (property change, text commit). */
  patchAnnotation: (id: string, patch: Partial<CaptureAnnotation>) => void;
  /** Not undo-tracked — for continuous updates inside a begin/endGesture pair. */
  moveAnnotation: (id: string, patch: Partial<CaptureAnnotation>) => void;
  /** Move an annotation to a new stacking position (last = topmost). */
  moveLayer: (id: string, toIndex: number) => void;
  removeAnnotation: (id: string) => void;
  /** Untracked removal — for discarding an empty text annotation whose creation entry already restores this exact state. */
  discardAnnotation: (id: string) => void;
  /** Undo-tracked. Null clears the crop back to the full image. */
  setCrop: (crop: Rect | null) => void;
  beginGesture: () => void;
  endGesture: () => void;
  undo: () => void;
  redo: () => void;
}

const HISTORY_CAP = 100;

/** One undo entry — everything the user can change that undo should restore. */
interface Snapshot {
  annotations: CaptureAnnotation[];
  crop: Rect | null;
}

function snapshot(state: Pick<EditorState, 'annotations' | 'crop'>): Snapshot {
  return { annotations: state.annotations, crop: state.crop };
}

function pushPast(state: EditorState): Pick<EditorState, 'past' | 'future'> {
  return { past: [...state.past, snapshot(state)].slice(-HISTORY_CAP), future: [] };
}

function applyPatch(
  annotations: CaptureAnnotation[],
  id: string,
  patch: Partial<CaptureAnnotation>
): CaptureAnnotation[] {
  return annotations.map((a) => (a.id === id ? ({ ...a, ...patch } as CaptureAnnotation) : a));
}

const initialState = {
  imageWidth: 0,
  imageHeight: 0,
  unit: 1,
  annotations: [] as CaptureAnnotation[],
  crop: null as Rect | null,
  cornerRadius: 0,
  tool: 'select' as EditorTool,
  selectedId: null,
  editingId: null,
  strokeTier: STROKE_TIERS[1].value,
  fontTier: FONT_TIERS[1].value,
  blurTier: BLUR_TIERS[1].value,
  past: [] as Snapshot[],
  future: [] as Snapshot[]
};

/** Snapshot at beginGesture — module-scope ref, not reactive state. */
let gestureStart: Snapshot | null = null;

export const useCaptureEditorStore = create<EditorState>((set, get) => ({
  ...initialState,
  color: EDITOR_COLORS[0],

  init: (imageWidth, imageHeight) =>
    set((state) => ({
      ...initialState,
      color: state.color,
      strokeTier: state.strokeTier,
      fontTier: state.fontTier,
      blurTier: state.blurTier,
      imageWidth,
      imageHeight,
      unit: imageUnit(imageWidth)
    })),

  reset: () =>
    set((state) => ({
      ...initialState,
      color: state.color,
      strokeTier: state.strokeTier,
      fontTier: state.fontTier,
      blurTier: state.blurTier
    })),

  setTool: (tool) => set({ tool, selectedId: null, editingId: null }),

  setColor: (color, id) =>
    set((state) => {
      const target = state.annotations.find((a) => a.id === (id ?? state.selectedId));
      if (!target || target.kind === 'blur') return { color };
      return {
        color,
        ...pushPast(state),
        annotations: applyPatch(state.annotations, target.id, { color })
      };
    }),

  setStrokeTier: (strokeTier, id) =>
    set((state) => {
      const target = state.annotations.find((a) => a.id === (id ?? state.selectedId));
      if (
        !target ||
        (target.kind !== 'rect' && target.kind !== 'circle' && target.kind !== 'arrow')
      )
        return { strokeTier };
      return {
        strokeTier,
        ...pushPast(state),
        annotations: applyPatch(state.annotations, target.id, {
          strokeWidth: strokeTier * state.unit
        })
      };
    }),

  setFontTier: (fontTier, id) =>
    set((state) => {
      const targetId = id ?? state.selectedId ?? state.editingId;
      const target = state.annotations.find((a) => a.id === targetId);
      if (!target || (target.kind !== 'text' && target.kind !== 'chip')) return { fontTier };
      return {
        fontTier,
        ...pushPast(state),
        annotations: applyPatch(state.annotations, target.id, {
          fontSize: fontTier * state.unit
        })
      };
    }),

  setBlurTier: (blurTier, id) =>
    set((state) => {
      const target = state.annotations.find((a) => a.id === (id ?? state.selectedId));
      if (!target || target.kind !== 'blur') return { blurTier };
      return {
        blurTier,
        ...pushPast(state),
        annotations: applyPatch(state.annotations, target.id, {
          blurRadius: blurTier * state.unit
        })
      };
    }),

  setCornerRadius: (cornerRadius) => set({ cornerRadius }),

  setSelectedId: (selectedId) => set({ selectedId }),

  setEditingId: (editingId) => set({ editingId }),

  addAnnotation: (annotation) =>
    set((state) => ({
      ...pushPast(state),
      annotations: [...state.annotations, annotation],
      selectedId: annotation.id
    })),

  patchAnnotation: (id, patch) =>
    set((state) => ({ ...pushPast(state), annotations: applyPatch(state.annotations, id, patch) })),

  moveAnnotation: (id, patch) =>
    set((state) => ({ annotations: applyPatch(state.annotations, id, patch) })),

  moveLayer: (id, toIndex) =>
    set((state) => {
      const next = reorderById(state.annotations, id, toIndex);
      if (next === state.annotations) return state;
      return { ...pushPast(state), annotations: next, selectedId: id };
    }),

  removeAnnotation: (id) =>
    set((state) => ({
      ...pushPast(state),
      annotations: state.annotations.filter((a) => a.id !== id),
      selectedId: state.selectedId === id ? null : state.selectedId,
      editingId: state.editingId === id ? null : state.editingId
    })),

  discardAnnotation: (id) =>
    set((state) => ({
      annotations: state.annotations.filter((a) => a.id !== id),
      selectedId: state.selectedId === id ? null : state.selectedId,
      editingId: state.editingId === id ? null : state.editingId
    })),

  setCrop: (crop) =>
    set((state) => ({
      ...pushPast(state),
      crop,
      tool: 'select' as EditorTool,
      selectedId: null,
      editingId: null
    })),

  beginGesture: () => {
    gestureStart = snapshot(get());
  },

  endGesture: () => {
    const start = gestureStart;
    gestureStart = null;
    if (!start || start.annotations === get().annotations) return;
    set((state) => ({
      past: [...state.past, start].slice(-HISTORY_CAP),
      future: []
    }));
  },

  undo: () =>
    set((state) => {
      const previous = state.past.at(-1);
      if (!previous) return state;
      return {
        ...previous,
        past: state.past.slice(0, -1),
        future: [...state.future, snapshot(state)],
        selectedId: null,
        editingId: null
      };
    }),

  redo: () =>
    set((state) => {
      const next = state.future.at(-1);
      if (!next) return state;
      return {
        ...next,
        future: state.future.slice(0, -1),
        past: [...state.past, snapshot(state)].slice(-HISTORY_CAP),
        selectedId: null,
        editingId: null
      };
    })
}));

/** Next auto-increment value for a numbered label badge. */
export function nextLabelValue(annotations: CaptureAnnotation[]): number {
  return annotations.reduce((max, a) => (a.kind === 'label' ? Math.max(max, a.value) : max), 0) + 1;
}

/** Moves the item with `id` so it ends up at `toIndex` in the result. Returns the input array when nothing changes. */
export function reorderById<T extends { id: string }>(list: T[], id: string, toIndex: number): T[] {
  const from = list.findIndex((item) => item.id === id);
  const to = Math.max(0, Math.min(toIndex, list.length - 1));
  if (from < 0 || to === from) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}
