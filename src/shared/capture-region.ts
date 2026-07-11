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
}
