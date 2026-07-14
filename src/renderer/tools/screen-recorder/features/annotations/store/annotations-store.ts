import { create } from 'zustand';
import type {
  Annotation,
  AnnotationBase,
  TextAnnotation,
  ArrowAnnotation,
  ImageAnnotation
} from '@screen-recorder/types/project';
import { REFERENCE_CANVAS_WIDTH } from '@shared/constants';

export const DEFAULT_ANNOTATION_DURATION_MS = 3000;
// Authored in REFERENCE_CANVAS_WIDTH units (same convention as webcam/cursor
// sizing), roughly centered so a freshly-added annotation lands somewhere
// visible on the stage instead of at (0,0).
const DEFAULT_POSITION = { x: REFERENCE_CANVAS_WIDTH / 2 - 60, y: 320 };
const DEFAULT_ARROW_LENGTH = 160;
export const DEFAULT_ARROW_COLOR = '#ffffff';
export const DEFAULT_ARROW_THICKNESS = 3;
export const MIN_ARROW_THICKNESS = 1;
export const MAX_ARROW_THICKNESS = 12;

type AnnotationPatch = Partial<Omit<AnnotationBase, 'id'>> &
  Partial<Pick<TextAnnotation, 'text' | 'animationPreset'>> &
  Partial<Pick<ArrowAnnotation, 'to' | 'color' | 'thickness' | 'style'>> &
  Partial<Pick<ImageAnnotation, 'assetPath'>>;

interface AnnotationsStoreState {
  annotations: Annotation[];
  /**
   * Which annotation is focused -- set by clicking its pill in
   * AnnotationTrack (which renders independently of the panel, in
   * CutTimeline), a card in AnnotationsPanel, or dragging it directly on the
   * preview stage, same pattern as `zoom-store`'s `selectedKeyframeId`.
   */
  selectedAnnotationId: string | null;
  addTextAnnotation: (atMs: number) => string;
  addArrowAnnotation: (atMs: number) => string;
  addImageAnnotation: (atMs: number, assetPath: string) => string;
  removeAnnotation: (id: string) => void;
  updateAnnotation: (id: string, patch: AnnotationPatch) => void;
  setSelectedAnnotationId: (id: string | null) => void;
}

export const useAnnotationsStore = create<AnnotationsStoreState>((set) => ({
  annotations: [],
  selectedAnnotationId: null,

  addTextAnnotation: (atMs) => {
    const id = crypto.randomUUID();
    const annotation: TextAnnotation = {
      id,
      kind: 'text',
      atMs,
      durationMs: DEFAULT_ANNOTATION_DURATION_MS,
      position: { ...DEFAULT_POSITION },
      text: 'New text',
      animationPreset: 'none'
    };
    set((state) => ({
      annotations: [...state.annotations, annotation],
      selectedAnnotationId: id
    }));
    return id;
  },

  addArrowAnnotation: (atMs) => {
    const id = crypto.randomUUID();
    const annotation: ArrowAnnotation = {
      id,
      kind: 'arrow',
      atMs,
      durationMs: DEFAULT_ANNOTATION_DURATION_MS,
      position: { ...DEFAULT_POSITION },
      to: { x: DEFAULT_POSITION.x + DEFAULT_ARROW_LENGTH, y: DEFAULT_POSITION.y },
      color: DEFAULT_ARROW_COLOR,
      thickness: DEFAULT_ARROW_THICKNESS,
      style: 'solid'
    };
    set((state) => ({
      annotations: [...state.annotations, annotation],
      selectedAnnotationId: id
    }));
    return id;
  },

  addImageAnnotation: (atMs, assetPath) => {
    const id = crypto.randomUUID();
    const annotation: ImageAnnotation = {
      id,
      kind: 'image',
      atMs,
      durationMs: DEFAULT_ANNOTATION_DURATION_MS,
      position: { ...DEFAULT_POSITION },
      assetPath
    };
    set((state) => ({
      annotations: [...state.annotations, annotation],
      selectedAnnotationId: id
    }));
    return id;
  },

  removeAnnotation: (id) =>
    set((state) => ({
      annotations: state.annotations.filter((a) => a.id !== id),
      selectedAnnotationId: state.selectedAnnotationId === id ? null : state.selectedAnnotationId
    })),

  updateAnnotation: (id, patch) =>
    set((state) => ({
      annotations: state.annotations.map((a) =>
        a.id === id ? ({ ...a, ...patch } as Annotation) : a
      )
    })),

  setSelectedAnnotationId: (selectedAnnotationId) => set({ selectedAnnotationId })
}));
