import type { CaptureTargetType } from '@screen-recorder/types/recording';

/**
 * Thumbnail-grid picker overlay opened from the capture toolbar's
 * Display/Window tabs. The overlay window sits on the cursor's monitor, but
 * the grid lists every matching source across all displays. Isolated from
 * the recorder overlay so a pick here requests a screenshot instead of
 * `recorderToolbar.requestStart`.
 */
export interface CaptureSourcePickerOverlayOpenOptions {
  type: CaptureTargetType;
  /** Stamped onto the pick so main can restore the pill for a countdown. */
  delaySeconds?: number;
}
