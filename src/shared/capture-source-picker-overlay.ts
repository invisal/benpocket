import type { CaptureTargetType } from '@screen-recorder/types/recording';

/**
 * Click-to-capture overlay opened from the capture toolbar's Display/Window
 * tabs. Same single-display scoping as the recorder overlay (cursor's monitor
 * at click time) -- see source-picker-overlay.ts. Isolated so a pick here
 * requests a screenshot instead of `recorderToolbar.requestStart`.
 */
export interface CaptureSourcePickerOverlayOpenOptions {
  type: CaptureTargetType;
  /** Stamped onto the pick so main can restore the pill for a countdown. */
  delaySeconds?: number;
}

export interface CaptureSourcePickerOverlayInit extends CaptureSourcePickerOverlayOpenOptions {
  /** Top-left of the overlay window in global screen coordinates. */
  origin: { x: number; y: number };
  /** `CaptureSource.displayId` of the display this overlay is scoped to. */
  targetDisplayId: string;
}
