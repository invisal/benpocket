import type { CaptureRegionSelection } from './capture-region';

/**
 * Cross-window payloads for the screen-capture toolbar: opening Screen Capture
 * leaves the main window visible (unlike the recorder toolbar, which minimizes
 * it) and floats a small always-on-top pill so the user can switch to another
 * BenPocket tool before grabbing. Toolbar and owner are separate renderer
 * processes -- everything that crosses between them is plain IPC, never a
 * shared store instance.
 */
export interface CaptureToolbarCapturePayload {
  sourceId: string;
  /** Set when the pill's Area picker already ran `screenshot.selectRegion`. */
  cropRegion?: CaptureRegionSelection;
}
