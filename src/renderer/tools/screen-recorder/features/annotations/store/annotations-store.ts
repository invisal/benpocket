import { create } from 'zustand';
import type {
  Annotation,
  AnnotationBase,
  TextAnnotation,
  ArrowAnnotation,
  ImageAnnotation
} from '@screen-recorder/types/project';
import { REFERENCE_CANVAS_WIDTH } from '@shared/constants';
import { withHistory } from '../../history/lib/with-history';

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

export const DEFAULT_TEXT_COLOR = '#ffffff';
// `null` means no pill -- text renders directly over the video, same as before this control existed.
export const DEFAULT_TEXT_BACKGROUND_COLOR = null;
export const DEFAULT_TEXT_FONT_SIZE = 28;
// Reference-canvas-unit sizes offered in the font-size picker.
export const TEXT_FONT_SIZE_OPTIONS = [16, 20, 24, 28, 32, 40, 48, 64] as const;
// Padding/corner radius of the background pill, in REFERENCE_CANVAS_WIDTH units.
export const TEXT_BACKGROUND_PADDING_X = 8;
export const TEXT_BACKGROUND_PADDING_Y = 4;
export const TEXT_BACKGROUND_RADIUS = 6;

export const DEFAULT_TEXT_ANIMATION_SPEED = 1;
export const MIN_TEXT_ANIMATION_SPEED = 0.5;
export const MAX_TEXT_ANIMATION_SPEED = 2;

// Floor on either dimension while dragging an image annotation's resize handles.
export const MIN_IMAGE_ANNOTATION_SIZE = 24;
export const DEFAULT_IMAGE_SIZE = { width: 320, height: 240 };
// REFERENCE_CANVAS_WIDTH has no fixed height counterpart -- the actual stage
// aspect ratio is a per-project setting this store has no access to (same
// reason DEFAULT_POSITION above isn't a true center either) -- so this
// assumes a typical 16:9 stage, close enough for "roughly centered."
const TYPICAL_REFERENCE_HEIGHT = (REFERENCE_CANVAS_WIDTH * 9) / 16;
const DEFAULT_IMAGE_POSITION = {
  x: REFERENCE_CANVAS_WIDTH / 2 - DEFAULT_IMAGE_SIZE.width / 2,
  y: TYPICAL_REFERENCE_HEIGHT / 2 - DEFAULT_IMAGE_SIZE.height / 2
};

type AnnotationPatch = Partial<Omit<AnnotationBase, 'id'>> &
  Partial<
    Pick<
      TextAnnotation,
      'text' | 'animationPreset' | 'animationSpeed' | 'color' | 'backgroundColor' | 'fontSize'
    >
  > &
  Partial<Pick<ArrowAnnotation, 'to' | 'color' | 'thickness' | 'style'>> &
  Partial<Pick<ImageAnnotation, 'assetPath' | 'size'>>;

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
  /** Copies the annotation to right after its own end -- returns the new id, or `null` if the source no longer exists. */
  duplicateAnnotation: (id: string) => string | null;
  removeAnnotation: (id: string) => void;
  updateAnnotation: (id: string, patch: AnnotationPatch) => void;
  setSelectedAnnotationId: (id: string | null) => void;
}

export const useAnnotationsStore = create<AnnotationsStoreState>(
  withHistory(
    'annotations',
    (s) => ({ annotations: s.annotations }),
    (set) => ({
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
          text: 'Enter text...',
          animationPreset: 'none',
          animationSpeed: DEFAULT_TEXT_ANIMATION_SPEED,
          color: DEFAULT_TEXT_COLOR,
          backgroundColor: DEFAULT_TEXT_BACKGROUND_COLOR,
          fontSize: DEFAULT_TEXT_FONT_SIZE,
          enabled: true
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
          style: 'solid',
          enabled: true
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
          position: { ...DEFAULT_IMAGE_POSITION },
          assetPath,
          size: { ...DEFAULT_IMAGE_SIZE },
          enabled: true
        };
        set((state) => ({
          annotations: [...state.annotations, annotation],
          selectedAnnotationId: id
        }));
        return id;
      },

      duplicateAnnotation: (id) => {
        let newId: string | null = null;
        set((state) => {
          const source = state.annotations.find((a) => a.id === id);
          if (!source) return state;
          newId = crypto.randomUUID();
          // Placed right after the source ends -- annotations (unlike zoom
          // keyframes) have no overlap constraint, so no clamping needed.
          const duplicate = { ...source, id: newId, atMs: source.atMs + source.durationMs };
          return { annotations: [...state.annotations, duplicate] };
        });
        return newId;
      },

      removeAnnotation: (id) =>
        set((state) => ({
          annotations: state.annotations.filter((a) => a.id !== id),
          selectedAnnotationId:
            state.selectedAnnotationId === id ? null : state.selectedAnnotationId
        })),

      updateAnnotation: (id, patch) =>
        set((state) => ({
          annotations: state.annotations.map((a) =>
            a.id === id ? ({ ...a, ...patch } as Annotation) : a
          )
        })),

      setSelectedAnnotationId: (selectedAnnotationId) => set({ selectedAnnotationId })
    })
  )
);
