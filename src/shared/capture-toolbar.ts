import type { CaptureRegionSelection } from './capture-region';

/**
 * Cross-window payloads for the screen-capture toolbar. Opening the pill
 * minimizes the owner (same as the recorder toolbar) so it isn't in the shot;
 * re-open from the dock / taskbar to capture BenPocket. Toolbar and owner are
 * separate renderer processes -- everything that crosses between them is
 * plain IPC, never a shared store instance.
 */
export interface CaptureToolbarCapturePayload {
  sourceId: string;
  /** Set when the pill's Area picker already ran `screenshot.selectRegion`. */
  cropRegion?: CaptureRegionSelection;
}
