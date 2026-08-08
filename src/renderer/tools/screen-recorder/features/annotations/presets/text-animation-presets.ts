export interface TextAnimationPreset {
  id: string;
  label: string;
  /** Tailwind `animate-*` class applied for the entrance window, see AnnotationOverlay. */
  className: string | null;
  /** Matches the animation's own CSS duration in main.css -- also the window `resolveTextEntrance` animates over. */
  durationMs: number;
}

/**
 * Picker options for `TextAnnotation.animationPreset`. AnnotationOverlay
 * plays this live via the Tailwind `animate-*` class named here; the export
 * rendering engine (`features/export/engine/rendering/effects/annotations.ts`)
 * bakes the same entrance (approximately -- see `resolveTextEntrance`) via
 * `resolveAnnotations` in `timeline-evaluator.ts`, using `durationMs` below
 * instead of CSS.
 */
export const TEXT_ANIMATION_PRESETS: TextAnimationPreset[] = [
  { id: 'none', label: 'None', className: null, durationMs: 0 },
  { id: 'fade-in', label: 'Fade in', className: 'animate-annotation-fade-in', durationMs: 400 },
  {
    id: 'slide-up',
    label: 'Slide up',
    className: 'animate-annotation-slide-up',
    durationMs: 400
  },
  { id: 'pop-in', label: 'Pop in', className: 'animate-annotation-pop-in', durationMs: 350 },
  {
    id: 'typewriter',
    label: 'Typewriter',
    className: 'animate-annotation-typewriter',
    durationMs: 900
  },
  { id: 'pulse', label: 'Pulse', className: 'animate-annotation-pulse', durationMs: 450 }
];

export function resolveTextAnimationPreset(id: string): TextAnimationPreset {
  return TEXT_ANIMATION_PRESETS.find((p) => p.id === id) ?? TEXT_ANIMATION_PRESETS[0];
}

/** Reference-canvas-unit Y offset the CSS `slide-up` keyframe uses (`translateY(12px)`). */
const SLIDE_UP_OFFSET = 12;

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/** Approximates CSS's bouncy `cubic-bezier(0.34, 1.56, 0.64, 1)` overshoot ease. */
function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

export interface TextEntranceTransform {
  alpha: number;
  /** Reference-canvas-unit Y offset to add to the annotation's resting position; caller scales by `referenceScale`. */
  offsetY: number;
  scale: number;
  /** The (possibly truncated, for `typewriter`) text to actually draw. */
  revealedText: string;
}

function clamp01(t: number): number {
  return Math.min(1, Math.max(0, t));
}

/**
 * One reveal step per character -- previously quantized to a fixed 18 steps
 * regardless of length, which for short text left long stretches where nothing
 * changed between jumps (most of those steps landed between character
 * boundaries) and for long text bunched multiple characters into each jump.
 * Matches the CSS side's `steps(text.length, end)` override, see AnnotationOverlay.
 */
function typewriterCharCount(t: number, textLength: number): number {
  return Math.round(clamp01(t) * textLength);
}

/**
 * Resolves a text annotation's entrance transform at `elapsedMs` since it
 * became active (`atMs - annotation.atMs`, always `>= 0`). Pure numeric
 * approximation of the CSS keyframes in main.css, used by the export
 * renderer (`timeline-evaluator.ts`'s `resolveAnnotations`) to bake the
 * animation into exported video. `text` is the annotation's full text --
 * `typewriter` slices it down to however many characters should be visible
 * so far, rather than trying to reproduce the CSS `clip-path` reveal (which
 * would need a Pixi mask kept in sync with the text's measured width).
 * `annotationDurationMs` is only used by `typewriter`, to mirror it back
 * into a "clearing" reveal-in-reverse once the annotation is about to go
 * inactive (see `annotation-typewriter-exit` in main.css). `speed` is
 * `TextAnnotation.animationSpeed` -- 1 = the preset's own duration below, 2 =
 * twice as fast (half the duration), etc.
 */
export function resolveTextEntrance(
  id: string,
  elapsedMs: number,
  speed: number,
  annotationDurationMs: number,
  text: string
): TextEntranceTransform {
  const preset = resolveTextAnimationPreset(id);
  const settled: TextEntranceTransform = { alpha: 1, offsetY: 0, scale: 1, revealedText: text };
  const durationMs = preset.durationMs / (speed > 0 ? speed : 1);

  if (preset.id === 'typewriter') {
    const remainingMs = annotationDurationMs - elapsedMs;
    // Only clear once typing-in has actually finished -- guards against a
    // total duration shorter than the reveal itself (the timeline pill
    // enforces a 300ms minimum, see MIN_ANNOTATION_DURATION_MS in
    // AnnotationTrack.tsx) flipping straight into "clearing" before
    // anything typed.
    if (elapsedMs >= durationMs && remainingMs <= durationMs) {
      const exitT = 1 - remainingMs / durationMs;
      const revealedCount = text.length - typewriterCharCount(exitT, text.length);
      return { ...settled, revealedText: text.slice(0, Math.max(0, revealedCount)) };
    }
    if (elapsedMs < durationMs) {
      const count = Math.max(1, typewriterCharCount(elapsedMs / durationMs, text.length));
      return { ...settled, revealedText: text.slice(0, count) };
    }
    return settled;
  }

  if (durationMs <= 0 || elapsedMs >= durationMs) return settled;

  const t = elapsedMs / durationMs;
  switch (preset.id) {
    case 'fade-in':
      return { ...settled, alpha: easeOutCubic(t) };
    case 'slide-up': {
      const eased = easeOutCubic(t);
      return { ...settled, alpha: eased, offsetY: SLIDE_UP_OFFSET * (1 - eased) };
    }
    case 'pop-in': {
      const eased = easeOutBack(t);
      return { ...settled, alpha: Math.min(1, Math.max(0, eased)), scale: 0.6 + 0.4 * eased };
    }
    case 'pulse': {
      const bump = 4 * t * (1 - t); // 0 at t=0/1, peaks at 1 when t=0.5
      return { ...settled, alpha: Math.min(1, t / 0.35), scale: 1 + 0.18 * bump };
    }
    default:
      return settled;
  }
}
