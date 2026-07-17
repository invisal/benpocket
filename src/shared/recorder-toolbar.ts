import type { AudioInputOptions, WebcamOptions } from '@screen-recorder/types/recording';
import type { CaptureRegionSelection, ScreenRect } from './capture-region';

/**
 * Cross-window payloads for the "recorder toolbar" flow: double-clicking a
 * source in the main window hides it (see window-visibility.ts) and opens a
 * small always-on-top settings bar (its own BrowserWindow + renderer, see
 * main/screen-recorder/windows/recorder-toolbar-window.ts) floating over the
 * real desktop -- so the user sees the actual window/screen instead of a
 * rendered copy inside the app. The toolbar and the (hidden) main window are
 * separate renderer processes with independent JS state, so everything that
 * crosses between them goes through the main process as plain data, never a
 * shared store instance.
 */
export interface RecorderToolbarOpenPayload {
  sourceId: string;
  audio: AudioInputOptions;
  webcam: WebcamOptions;
  /** Drag-selected sub-rectangle of a display ("Area" mode) -- see capture-engine.ts's live crop relay. */
  cropRegion?: CaptureRegionSelection;
}

export interface RecorderToolbarStartPayload extends RecorderToolbarOpenPayload {
  /**
   * Screen-space rect of what's actually being recorded, if known -- the
   * full display for a 'screen' source, the drag-selected rect for "Area"
   * mode, or omitted for a 'window' source with no resolvable bounds (most
   * of them -- see CaptureSource.displayBounds). Lets the toolbar reposition
   * itself next to the thing it's controlling instead of always sitting at
   * the bottom of the primary display -- see recorder-toolbar-window.ts.
   */
  targetBounds?: ScreenRect;
}

export interface RecorderToolbarRecordingResult {
  ok: boolean;
  error?: string;
}
