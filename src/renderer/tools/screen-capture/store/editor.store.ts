import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { WALLPAPER_PRESETS } from '@shared/wallpaper-presets';
import { imageUnit, type Rect } from '../lib/flatten';
import type { BackgroundConfig, CaptureAnnotation, EditorTool } from '../types/editor';

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

/** Output frame sizes for the background tool; "Custom" is any width/height not matching one of these. */
export const BACKGROUND_SIZE_PRESETS = [
  { id: 'full-hd', label: 'Full HD', width: 1920, height: 1080 },
  { id: 'facebook-post', label: 'Facebook post', width: 1200, height: 630 },
  { id: 'instagram-post', label: 'Instagram post', width: 1080, height: 1080 },
  { id: 'x-post', label: 'X post', width: 1600, height: 900 },
  { id: 'linkedin-post', label: 'LinkedIn post', width: 1200, height: 627 },
  { id: 'instagram-story', label: 'Instagram story', width: 1080, height: 1920 },
  { id: 'pinterest-pin', label: 'Pinterest pin', width: 1000, height: 1500 }
];

/** Turning the background on starts from the screen-recorder's default wallpaper at Full HD. */
export const DEFAULT_BACKGROUND: BackgroundConfig = {
  wallpaper: WALLPAPER_PRESETS[0].id,
  width: BACKGROUND_SIZE_PRESETS[0].width,
  height: BACKGROUND_SIZE_PRESETS[0].height,
  marginPct: 5,
  cornerRadius: 0
};

/** Annotation/tool kinds that own independent color/stroke/font/blur defaults. */
export type StyleTool =
  'text' | 'chip' | 'label' | 'rect' | 'circle' | 'arrow' | 'line' | 'pen' | 'blur';

const STYLE_TOOLS: StyleTool[] = [
  'text',
  'chip',
  'label',
  'rect',
  'circle',
  'arrow',
  'line',
  'pen',
  'blur'
];

export interface ToolStyle {
  color: string;
  strokeTier: number;
  fontTier: number;
  blurTier: number;
}

function defaultToolStyle(): ToolStyle {
  return {
    color: EDITOR_COLORS[0],
    strokeTier: STROKE_TIERS[1].value,
    fontTier: FONT_TIERS[1].value,
    blurTier: BLUR_TIERS[1].value
  };
}

/** Per-tool defaults; chip starts white + large text (matches the old hard-coded addChip). */
export function defaultToolStyles(): Record<StyleTool, ToolStyle> {
  const base = defaultToolStyle();
  return {
    text: { ...base },
    chip: { ...base, color: '#ffffff', fontTier: FONT_TIERS.at(-1)!.value },
    label: { ...base },
    rect: { ...base },
    circle: { ...base },
    arrow: { ...base },
    line: { ...base },
    pen: { ...base },
    blur: { ...base }
  };
}

export function isStyleTool(tool: string): tool is StyleTool {
  return (STYLE_TOOLS as string[]).includes(tool);
}

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
  /**
   * Corner radius in `unit`s — persisted across sessions so a new capture
   * at a different resolution gets the same relative roundness.
   */
  cornerRadiusUnits: number;
  // ponytail: like cornerRadius, background/watermark/penSnap are not undo-tracked —
  // every popover/toggle is self-reverting. Upgrade path: fold into Snapshot.
  /** Frame the export is composited onto, or null for the bare capture. */
  background: BackgroundConfig | null;
  /** Draws "benpocket/screen-capture" in the output's bottom-right corner. On by default. */
  watermark: boolean;
  /** When on, freehand strokes snap to line/rect/circle (Shift still forces freehand). */
  penSnap: boolean;
  /** Last color/stroke/font/blur per drawing tool — independent across tools. */
  toolStyles: Record<StyleTool, ToolStyle>;
  tool: EditorTool;
  selectedId: string | null;
  /** Text annotation currently showing its inline text input. */
  editingId: string | null;
  /** Working defaults for the active tool (loaded from toolStyles on setTool). */
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
  setBackground: (background: BackgroundConfig | null) => void;
  setWatermark: (watermark: boolean) => void;
  setPenSnap: (penSnap: boolean) => void;
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

function patchToolStyle(
  toolStyles: Record<StyleTool, ToolStyle>,
  key: StyleTool,
  patch: Partial<ToolStyle>
): Record<StyleTool, ToolStyle> {
  return { ...toolStyles, [key]: { ...toolStyles[key], ...patch } };
}

/** Which toolStyles bucket a setter should write — annotation kind, else the active tool. */
function styleKeyForWrite(
  state: Pick<EditorState, 'tool' | 'annotations' | 'selectedId' | 'editingId'>,
  id?: string,
  kinds?: StyleTool[]
): StyleTool | null {
  const target = state.annotations.find(
    (a) => a.id === (id ?? state.selectedId ?? state.editingId)
  );
  if (target && isStyleTool(target.kind) && (!kinds || kinds.includes(target.kind))) {
    return target.kind;
  }
  if (isStyleTool(state.tool) && (!kinds || kinds.includes(state.tool))) return state.tool;
  return null;
}

const initialState = {
  imageWidth: 0,
  imageHeight: 0,
  unit: 1,
  annotations: [] as CaptureAnnotation[],
  crop: null as Rect | null,
  cornerRadius: 0,
  cornerRadiusUnits: 0,
  background: null as BackgroundConfig | null,
  watermark: true,
  penSnap: true,
  toolStyles: defaultToolStyles(),
  tool: 'select' as EditorTool,
  selectedId: null,
  editingId: null,
  color: EDITOR_COLORS[0],
  strokeTier: STROKE_TIERS[1].value,
  fontTier: FONT_TIERS[1].value,
  blurTier: BLUR_TIERS[1].value,
  past: [] as Snapshot[],
  future: [] as Snapshot[]
};

/** Prefs written to localStorage — survive app restarts. */
type PersistedEditorPrefs = {
  toolStyles: Record<StyleTool, ToolStyle>;
  penSnap: boolean;
  watermark: boolean;
  background: BackgroundConfig | null;
  cornerRadiusUnits: number;
};

const PREFS_KEY = 'screen-capture.editor-prefs.v2';

function sanitizeBackground(value: unknown): BackgroundConfig | null {
  if (value === null) return null;
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  const wallpaper = typeof v.wallpaper === 'string' ? v.wallpaper : null;
  const width = typeof v.width === 'number' ? v.width : null;
  const height = typeof v.height === 'number' ? v.height : null;
  const marginPct = typeof v.marginPct === 'number' ? v.marginPct : null;
  const cornerRadius = typeof v.cornerRadius === 'number' ? v.cornerRadius : null;
  if (!wallpaper || !WALLPAPER_PRESETS.some((p) => p.id === wallpaper)) return null;
  if (width === null || height === null || marginPct === null || cornerRadius === null) return null;
  if (width < 1 || height < 1 || width > 8192 || height > 8192) return null;
  return {
    wallpaper,
    width: Math.round(width),
    height: Math.round(height),
    marginPct: Math.min(25, Math.max(0, marginPct)),
    cornerRadius: Math.min(128, Math.max(0, Math.round(cornerRadius)))
  };
}

function sanitizeToolStyle(value: unknown, fallback: ToolStyle): ToolStyle {
  if (!value || typeof value !== 'object') return { ...fallback };
  const v = value as Record<string, unknown>;
  return {
    color:
      typeof v.color === 'string' && EDITOR_COLORS.includes(v.color) ? v.color : fallback.color,
    strokeTier:
      typeof v.strokeTier === 'number' && STROKE_TIERS.some((t) => t.value === v.strokeTier)
        ? v.strokeTier
        : fallback.strokeTier,
    fontTier:
      typeof v.fontTier === 'number' && FONT_TIERS.some((t) => t.value === v.fontTier)
        ? v.fontTier
        : fallback.fontTier,
    blurTier:
      typeof v.blurTier === 'number' && BLUR_TIERS.some((t) => t.value === v.blurTier)
        ? v.blurTier
        : fallback.blurTier
  };
}

function sanitizePrefs(raw: unknown): Partial<PersistedEditorPrefs> {
  if (!raw || typeof raw !== 'object') return {};
  const v = raw as Record<string, unknown>;
  const out: Partial<PersistedEditorPrefs> = {};
  const defaults = defaultToolStyles();

  if (v.toolStyles && typeof v.toolStyles === 'object') {
    const rawStyles = v.toolStyles as Record<string, unknown>;
    const toolStyles = { ...defaults };
    for (const key of STYLE_TOOLS) {
      toolStyles[key] = sanitizeToolStyle(rawStyles[key], defaults[key]);
    }
    out.toolStyles = toolStyles;
  } else if (
    typeof v.color === 'string' ||
    typeof v.strokeTier === 'number' ||
    typeof v.fontTier === 'number' ||
    typeof v.blurTier === 'number'
  ) {
    // Migrate pre-per-tool prefs: seed every tool from the old shared defaults.
    const legacy = sanitizeToolStyle(v, defaultToolStyle());
    const toolStyles = defaultToolStyles();
    for (const key of STYLE_TOOLS) {
      toolStyles[key] = {
        ...toolStyles[key],
        color: legacy.color,
        strokeTier: legacy.strokeTier,
        fontTier: legacy.fontTier,
        blurTier: legacy.blurTier
      };
    }
    if (typeof v.color !== 'string') {
      toolStyles.chip = defaults.chip;
    }
    out.toolStyles = toolStyles;
  }

  if (typeof v.penSnap === 'boolean') out.penSnap = v.penSnap;
  if (typeof v.watermark === 'boolean') out.watermark = v.watermark;
  if ('background' in v) out.background = sanitizeBackground(v.background);
  if (typeof v.cornerRadiusUnits === 'number' && Number.isFinite(v.cornerRadiusUnits)) {
    out.cornerRadiusUnits = Math.min(
      MAX_CORNER_RADIUS_UNITS,
      Math.max(0, Math.round(v.cornerRadiusUnits))
    );
  }
  return out;
}

/** Session-level prefs kept across capture reset / image init. */
function sessionPrefs(
  state: EditorState
): Pick<
  EditorState,
  | 'toolStyles'
  | 'penSnap'
  | 'watermark'
  | 'background'
  | 'cornerRadiusUnits'
  | 'color'
  | 'strokeTier'
  | 'fontTier'
  | 'blurTier'
> {
  return {
    toolStyles: state.toolStyles,
    penSnap: state.penSnap,
    watermark: state.watermark,
    background: state.background,
    cornerRadiusUnits: state.cornerRadiusUnits,
    color: state.color,
    strokeTier: state.strokeTier,
    fontTier: state.fontTier,
    blurTier: state.blurTier
  };
}

function workingStyle(
  style: ToolStyle
): Pick<EditorState, 'color' | 'strokeTier' | 'fontTier' | 'blurTier'> {
  return {
    color: style.color,
    strokeTier: style.strokeTier,
    fontTier: style.fontTier,
    blurTier: style.blurTier
  };
}

/**
 * Working color/stroke/font/blur belong to the active tool only. Editing a
 * layer of another kind must not overwrite them (e.g. a white chip must not
 * turn the next pen stroke white).
 */
function workingIfActiveTool(
  state: Pick<EditorState, 'tool'>,
  targetKind: StyleTool | null,
  patch: Partial<Pick<EditorState, 'color' | 'strokeTier' | 'fontTier' | 'blurTier'>>
): Partial<Pick<EditorState, 'color' | 'strokeTier' | 'fontTier' | 'blurTier'>> {
  if (!isStyleTool(state.tool)) return {};
  if (targetKind && targetKind !== state.tool) return {};
  return patch;
}

/** Snapshot at beginGesture — module-scope ref, not reactive state. */
let gestureStart: Snapshot | null = null;

export const useCaptureEditorStore = create<EditorState>()(
  persist(
    (set, get) => ({
      ...initialState,

      init: (imageWidth, imageHeight) =>
        set((state) => {
          const unit = imageUnit(imageWidth);
          return {
            ...initialState,
            ...sessionPrefs(state),
            cornerRadius: state.cornerRadiusUnits * unit,
            imageWidth,
            imageHeight,
            unit
          };
        }),

      reset: () =>
        set((state) => ({
          ...initialState,
          ...sessionPrefs(state),
          // No image yet — px radius is applied again in init().
          cornerRadius: 0
        })),

      setTool: (tool) =>
        set((state) => {
          if (!isStyleTool(tool)) {
            return { tool, selectedId: null, editingId: null };
          }
          return {
            tool,
            selectedId: null,
            editingId: null,
            ...workingStyle(state.toolStyles[tool])
          };
        }),

      setColor: (color, id) =>
        set((state) => {
          const target = state.annotations.find((a) => a.id === (id ?? state.selectedId));
          const key = styleKeyForWrite(
            state,
            id,
            STYLE_TOOLS.filter((k) => k !== 'blur')
          );
          const toolStyles = key
            ? patchToolStyle(state.toolStyles, key, { color })
            : state.toolStyles;
          const working = workingIfActiveTool(
            state,
            target && isStyleTool(target.kind) ? target.kind : key,
            { color }
          );
          if (!target || target.kind === 'blur') {
            return { ...working, toolStyles, ...(target ? { selectedId: target.id } : {}) };
          }
          return {
            ...working,
            toolStyles,
            selectedId: target.id,
            ...pushPast(state),
            annotations: applyPatch(state.annotations, target.id, { color })
          };
        }),

      setStrokeTier: (strokeTier, id) =>
        set((state) => {
          const strokeKinds: StyleTool[] = ['rect', 'circle', 'arrow', 'line', 'pen'];
          const target = state.annotations.find((a) => a.id === (id ?? state.selectedId));
          const key = styleKeyForWrite(state, id, strokeKinds);
          const toolStyles = key
            ? patchToolStyle(state.toolStyles, key, { strokeTier })
            : state.toolStyles;
          const working = workingIfActiveTool(
            state,
            target && isStyleTool(target.kind) ? target.kind : key,
            { strokeTier }
          );
          if (!target || !strokeKinds.includes(target.kind as StyleTool)) {
            return {
              ...working,
              toolStyles,
              ...(target ? { selectedId: target.id } : {})
            };
          }
          return {
            ...working,
            toolStyles,
            selectedId: target.id,
            ...pushPast(state),
            annotations: applyPatch(state.annotations, target.id, {
              strokeWidth: strokeTier * state.unit
            })
          };
        }),

      setFontTier: (fontTier, id) =>
        set((state) => {
          const fontKinds: StyleTool[] = ['text', 'chip'];
          const targetId = id ?? state.selectedId ?? state.editingId;
          const target = state.annotations.find((a) => a.id === targetId);
          const key = styleKeyForWrite(state, id, fontKinds);
          const toolStyles = key
            ? patchToolStyle(state.toolStyles, key, { fontTier })
            : state.toolStyles;
          const working = workingIfActiveTool(
            state,
            target && isStyleTool(target.kind) ? target.kind : key,
            { fontTier }
          );
          if (!target || (target.kind !== 'text' && target.kind !== 'chip')) {
            return {
              ...working,
              toolStyles,
              ...(target ? { selectedId: target.id } : {})
            };
          }
          return {
            ...working,
            toolStyles,
            selectedId: target.id,
            ...pushPast(state),
            annotations: applyPatch(state.annotations, target.id, {
              fontSize: fontTier * state.unit
            })
          };
        }),

      setBlurTier: (blurTier, id) =>
        set((state) => {
          const target = state.annotations.find((a) => a.id === (id ?? state.selectedId));
          const key = styleKeyForWrite(state, id, ['blur']);
          const toolStyles = key
            ? patchToolStyle(state.toolStyles, key, { blurTier })
            : state.toolStyles;
          const working = workingIfActiveTool(
            state,
            target && isStyleTool(target.kind) ? target.kind : key,
            { blurTier }
          );
          if (!target || target.kind !== 'blur') {
            return {
              ...working,
              toolStyles,
              ...(target ? { selectedId: target.id } : {})
            };
          }
          return {
            ...working,
            toolStyles,
            selectedId: target.id,
            ...pushPast(state),
            annotations: applyPatch(state.annotations, target.id, {
              blurRadius: blurTier * state.unit
            })
          };
        }),

      setCornerRadius: (cornerRadius) =>
        set((state) => ({
          cornerRadius,
          cornerRadiusUnits: Math.round(cornerRadius / state.unit)
        })),

      setBackground: (background) => set({ background }),

      setWatermark: (watermark) => set({ watermark }),

      setPenSnap: (penSnap) => set({ penSnap }),

      setSelectedId: (selectedId) => set({ selectedId }),

      setEditingId: (editingId) => set({ editingId }),

      addAnnotation: (annotation) =>
        set((state) => ({
          ...pushPast(state),
          annotations: [...state.annotations, annotation],
          selectedId: annotation.id
        })),

      patchAnnotation: (id, patch) =>
        set((state) => ({
          ...pushPast(state),
          annotations: applyPatch(state.annotations, id, patch)
        })),

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
    }),
    {
      name: PREFS_KEY,
      partialize: (state): PersistedEditorPrefs => ({
        toolStyles: state.toolStyles,
        penSnap: state.penSnap,
        watermark: state.watermark,
        background: state.background,
        cornerRadiusUnits: state.cornerRadiusUnits
      }),
      merge: (persisted, current) => {
        const prefs = sanitizePrefs(persisted);
        const toolStyles = prefs.toolStyles ?? current.toolStyles;
        const tool = current.tool;
        const style = isStyleTool(tool) ? toolStyles[tool] : null;
        return {
          ...current,
          ...prefs,
          toolStyles,
          ...(style ? workingStyle(style) : {})
        };
      }
    }
  )
);

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
