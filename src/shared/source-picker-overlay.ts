import type { CaptureTargetType } from '@screen-recorder/types/recording';

/**
 * The click-to-record overlay opened from the focus toolbar's Display/Window
 * tabs (see main/screen-recorder/windows/source-picker-overlay-window.ts).
 * Scoped to a single display -- whichever one the cursor is on at the moment
 * Display/Window is clicked -- rather than spanning the whole virtual
 * desktop: Electron/macOS was only actually rendering content on one display
 * of a window that spans several (see the window-creation comment), and
 * that one wasn't reliably the display the user was looking at, so a
 * "click any monitor" overlay silently became "the overlay only works on
 * whichever monitor happens to win that render". For 'screen', we have
 * exact bounds for the display, so it draws one real, correctly-positioned
 * "Start Recording" panel over it. For 'window', desktopCapturer gives us no
 * on-screen position for arbitrary windows, so it falls back to a
 * best-effort thumbnail grid instead of a true per-window overlay.
 */
export interface SourcePickerOverlayOpenOptions {
  type: CaptureTargetType;
}

export interface SourcePickerOverlayInit extends SourcePickerOverlayOpenOptions {
  /**
   * Top-left of the overlay window itself, in global screen coordinates --
   * CaptureSource.displayBounds is also in global coordinates, so the
   * renderer needs this to convert the target display's bounds into a
   * CSS-relative position for its panel.
   */
  origin: { x: number; y: number };
  /**
   * `CaptureSource.displayId` of the single display this overlay is scoped
   * to -- the renderer filters the 'screen' source list down to just this
   * one instead of trusting every screen source's displayBounds to land
   * somewhere visible inside this (now single-display-sized) window.
   */
  targetDisplayId: string;
}
