import { create } from 'zustand';
import { imageUnit } from '../lib/flatten';
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
  // ponytail: undo covers annotations only — cornerRadius is a slider the
  // user can just drag back; tracking it would spam the stack on every input
  // event. Upgrade path: begin/end gesture around slider drags.
  past: CaptureAnnotation[][];
  future: CaptureAnnotation[][];
  init: (imageWidth: number, imageHeight: number) => void;
  reset: () => void;
  setTool: (tool: EditorTool) => void;
  setColor: (color: string) => void;
  setStrokeTier: (tier: number) => void;
  setFontTier: (tier: number) => void;
  setCornerRadius: (radius: number) => void;
  setSelectedId: (id: string | null) => void;
  setEditingId: (id: string | null) => void;
  addAnnotation: (annotation: CaptureAnnotation) => void;
  /** Undo-tracked change — for discrete edits (property change, text commit). */
  patchAnnotation: (id: string, patch: Partial<CaptureAnnotation>) => void;
  /** Not undo-tracked — for continuous updates inside a begin/endGesture pair. */
  moveAnnotation: (id: string, patch: Partial<CaptureAnnotation>) => void;
  removeAnnotation: (id: string) => void;
  /** Untracked removal — for discarding an empty text annotation whose creation entry already restores this exact state. */
  discardAnnotation: (id: string) => void;
  beginGesture: () => void;
  endGesture: () => void;
  undo: () => void;
  redo: () => void;
}

const HISTORY_CAP = 100;

function pushPast(state: EditorState): Pick<EditorState, 'past' | 'future'> {
  return { past: [...state.past, state.annotations].slice(-HISTORY_CAP), future: [] };
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
  cornerRadius: 0,
  tool: 'select' as EditorTool,
  selectedId: null,
  editingId: null,
  strokeTier: STROKE_TIERS[1].value,
  fontTier: FONT_TIERS[1].value,
  past: [] as CaptureAnnotation[][],
  future: [] as CaptureAnnotation[][]
};

/** Annotations snapshot at beginGesture — module-scope ref, not reactive state. */
let gestureStart: CaptureAnnotation[] | null = null;

export const useCaptureEditorStore = create<EditorState>((set, get) => ({
  ...initialState,
  color: EDITOR_COLORS[0],

  init: (imageWidth, imageHeight) =>
    set((state) => ({
      ...initialState,
      color: state.color,
      strokeTier: state.strokeTier,
      fontTier: state.fontTier,
      imageWidth,
      imageHeight,
      unit: imageUnit(imageWidth)
    })),

  reset: () =>
    set((state) => ({
      ...initialState,
      color: state.color,
      strokeTier: state.strokeTier,
      fontTier: state.fontTier
    })),

  setTool: (tool) => set({ tool, selectedId: null, editingId: null }),

  setColor: (color) =>
    set((state) => {
      const selected = state.annotations.find((a) => a.id === state.selectedId);
      if (!selected || selected.kind === 'blur') return { color };
      return {
        color,
        ...pushPast(state),
        annotations: applyPatch(state.annotations, selected.id, { color })
      };
    }),

  setStrokeTier: (strokeTier) =>
    set((state) => {
      const selected = state.annotations.find((a) => a.id === state.selectedId);
      if (!selected || (selected.kind !== 'rect' && selected.kind !== 'arrow'))
        return { strokeTier };
      return {
        strokeTier,
        ...pushPast(state),
        annotations: applyPatch(state.annotations, selected.id, {
          strokeWidth: strokeTier * state.unit
        })
      };
    }),

  setFontTier: (fontTier) =>
    set((state) => {
      const targetId = state.selectedId ?? state.editingId;
      const target = state.annotations.find((a) => a.id === targetId);
      if (!target || target.kind !== 'text') return { fontTier };
      return {
        fontTier,
        ...pushPast(state),
        annotations: applyPatch(state.annotations, target.id, {
          fontSize: fontTier * state.unit
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

  beginGesture: () => {
    gestureStart = get().annotations;
  },

  endGesture: () => {
    const start = gestureStart;
    gestureStart = null;
    if (!start || start === get().annotations) return;
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
        annotations: previous,
        past: state.past.slice(0, -1),
        future: [...state.future, state.annotations],
        selectedId: null,
        editingId: null
      };
    }),

  redo: () =>
    set((state) => {
      const next = state.future.at(-1);
      if (!next) return state;
      return {
        annotations: next,
        future: state.future.slice(0, -1),
        past: [...state.past, state.annotations].slice(-HISTORY_CAP),
        selectedId: null,
        editingId: null
      };
    })
}));

/** Next auto-increment value for a numbered label badge. */
export function nextLabelValue(annotations: CaptureAnnotation[]): number {
  return annotations.reduce((max, a) => (a.kind === 'label' ? Math.max(max, a.value) : max), 0) + 1;
}
