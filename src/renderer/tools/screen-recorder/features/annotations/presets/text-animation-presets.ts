export interface TextAnimationPreset {
  id: string;
  label: string;
  /** Tailwind `animate-*` class applied for the entrance window, see AnnotationOverlay. */
  className: string | null;
}

/**
 * Picker options for `TextAnnotation.animationPreset`. Purely a live-preview
 * affordance (AnnotationOverlay plays the entrance animation for the first
 * `ENTRANCE_WINDOW_MS` of an annotation's active window) -- the export
 * rendering engine
 * (`features/export/engine/rendering/effects/annotations.ts`) draws text as a
 * static frame and does not read this field, so the choice here has no
 * effect on exported video yet. Baking real enter/exit animation into the
 * PixiJS-backed export pipeline is a separate, larger piece of work.
 */
export const TEXT_ANIMATION_PRESETS: TextAnimationPreset[] = [
  { id: 'none', label: 'None', className: null },
  { id: 'fade-in', label: 'Fade in', className: 'animate-annotation-fade-in' },
  { id: 'slide-up', label: 'Slide up', className: 'animate-annotation-slide-up' },
  { id: 'pop-in', label: 'Pop in', className: 'animate-annotation-pop-in' }
];

export function resolveTextAnimationPreset(id: string): TextAnimationPreset {
  return TEXT_ANIMATION_PRESETS.find((p) => p.id === id) ?? TEXT_ANIMATION_PRESETS[0];
}
