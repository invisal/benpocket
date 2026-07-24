export interface ScreenRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Region drag result in global screen coordinates plus the matched display. */
export interface CaptureRegionSelection {
  rect: ScreenRect;
  displayBounds: ScreenRect;
  /** Electron display scale factor (DIP → physical pixels). */
  scaleFactor?: number;
  /**
   * When true, `rect` is already in capture-bitmap pixel space and
   * `displayBounds` is `{ x:0, y:0, width:bitmapW, height:bitmapH }`.
   */
  imageSpace?: boolean;
}

/** Options for the fullscreen region-drag overlay. */
export interface SelectCaptureRegionOptions {
  /**
   * JPEG bytes of the screen to paint under the dimming mask (preferred — fast IPC).
   * Selection maps directly into this bitmap (no screen-coordinate hop).
   */
  backdropJpeg?: ArrayBuffer;
  /** @deprecated Prefer backdropJpeg — base64 data URLs stall the overlay open. */
  backdropDataUrl?: string;
  /** Size/position the overlay for this display (defaults to virtual desktop). */
  bounds?: ScreenRect;
  /**
   * Report the drag relative to the overlay's own content box (0-based) with
   * `displayBounds` set to the overlay's size, instead of adding the window's
   * global origin. Wayland hides a window's absolute position, so the global
   * origin is unreliable there; this keeps the crop math purely in
   * overlay-local space. Requires the overlay to cover exactly the captured
   * display (pass `bounds`).
   */
  overlayRelative?: boolean;
  /**
   * Switches the overlay from "complete on mouse-up" to "show a Size/
   * Position readout + a confirm button labeled with this string, and wait
   * for a click" -- see region-select.ts. Undefined keeps the original
   * instant-complete behavior (Screen Capture's region screenshot).
   */
  confirmLabel?: string;
}

/** Payload from the overlay renderer when the user finishes a drag. */
export type RegionSelectCompletePayload =
  | ScreenRect
  | {
      rect: ScreenRect;
      imageSpace: true;
      imageWidth: number;
      imageHeight: number;
    };
