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
