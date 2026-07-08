export interface TextAnimationPreset {
  id: string;
  label: string;
  enterMs: number;
  exitMs: number;
}

// TODO: implement the actual keyframe/easing definitions per preset and
// apply them when rendering TextAnnotation during preview/export.
export const textAnimationPresets: TextAnimationPreset[] = [
  { id: 'fade', label: 'Fade', enterMs: 200, exitMs: 200 },
  { id: 'pop', label: 'Pop', enterMs: 150, exitMs: 150 },
  { id: 'slide-up', label: 'Slide Up', enterMs: 250, exitMs: 200 },
  { id: 'typewriter', label: 'Typewriter', enterMs: 600, exitMs: 100 }
];
