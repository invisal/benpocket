import type {
  AudioInputOptions,
  CaptureSource,
  WebcamOptions
} from '@screen-recorder/types/recording';
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
  /** Omitted when opening "fresh" (no source picked yet) -- see openRecorderToolbarFor, which no longer waits on a slow capture-sources fetch before opening. The toolbar picks its own default once its own fetch resolves. */
  source?: CaptureSource;
  audio: AudioInputOptions;
  webcam: WebcamOptions;
  /** Drag-selected sub-rectangle of a display ("Area" mode) -- see capture-engine.ts's live crop relay. */
  cropRegion?: CaptureRegionSelection;
  /**
   * Live cursor-visibility/click-highlight settings for the toolbar's
   * Recording preferences menu to seed from and round-trip back on start --
   * these belong to useCursorStore, a separate per-process store instance
   * the toolbar can't safely mutate directly (see RecorderToolbarBridge.tsx,
   * which applies these to the real store).
   */
  cursorSettings: { visible: boolean; clickRippleEnabled: boolean };
  /** Seconds to count down before recording actually starts -- see useRecordingStore.countdownSeconds. */
  countdownSeconds: number;
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
  /** Whether this recording is on the native helper path -- only it supports Pause/Resume (see CaptureHandle.native in capture-engine.ts). */
  native?: boolean;
}
