/**
 * Shared contract for the subprocess-based native recording helpers
 * (native/macos-recorder, native/windows-recorder, native/linux-recorder)
 * -- a standalone executable per platform, spawned with one JSON config
 * argument, that owns the entire capture pipeline (video with cursor
 * hidden, system/mic audio, H.264 encode, MP4 mux) and writes directly to
 * the given output path. See the plan this was built from for why this
 * replaced an earlier in-process N-API addon attempt (a chain of
 * ARC/threading/IPC bugs that a real subprocess boundary avoids entirely).
 *
 * Permission handling lives inside each helper (CGRequestScreenCaptureAccess
 * on macOS; no OS-level gate on Windows/Linux) -- there's deliberately no
 * separate check/request permission surface here the way the old in-process
 * addon needed, since a failed/denied permission just surfaces as a normal
 * start failure (`NativeRecordingStartResult`'s `ok: false`).
 */

export interface NativeRecordingSource {
  kind: 'display' | 'window';
  /** Display sources only. */
  displayId?: number;
  /** Window sources only -- the native handle embedded in desktopCapturer's `id`. */
  windowHandle?: number;
  /** Window sources only -- desktopCapturer's `source.name`, used as a fallback match when the handle doesn't resolve (see native/macos-recorder's target resolution). */
  windowTitle?: string;
  /** Display sources only -- Electron's own bounds for the picked Display, the primary signal for matching against the platform's own display enumeration. */
  bounds?: { x: number; y: number; width: number; height: number };
  /**
   * Drag-selected sub-rectangle of a display source ("Area" mode), as a 0-1
   * fraction of the display's own width/height -- fraction rather than raw
   * points/pixels so it doesn't matter whether the renderer measured in DIP
   * or bitmap-pixel space (see capture-region.ts's `imageSpace` caveat);
   * each helper converts to its own real points/pixels from its own
   * authoritative display data. macOS only for now (ScreenCaptureKit's
   * `sourceRect` makes this a real native crop there) -- gated by
   * `NativeRecordingSupport.supportsCrop`, see `tryStartNativeRecording` in
   * capture-engine.ts.
   */
  cropFraction?: { x: number; y: number; width: number; height: number };
}

/** What the renderer sends over IPC -- no output path, since the main process owns choosing/computing where recordings live (same `~/Movies/ScreenRecorder/` convention `SaveRecordingFile` already uses), not the renderer. */
export interface NativeRecordingRequest {
  source: NativeRecordingSource;
  frameRate: number;
  width: number;
  height: number;
  /** Hides the native OS cursor at the compositor level -- the entire point of this bridge. */
  hideCursor: boolean;
  systemAudioEnabled: boolean;
  microphoneEnabled: boolean;
  microphoneDeviceId?: string;
  microphoneDeviceName?: string;
}

/** What `recording-helper.ts` actually spawns the subprocess with -- a `NativeRecordingRequest` plus the resolved final destination path. */
export interface NativeRecordingOptions extends NativeRecordingRequest {
  /** Final destination -- the helper writes here directly, no separate save/copy step afterward. */
  outputPath: string;
}

export interface NativeRecordingSupport {
  /** Whether a helper binary exists for the current platform/arch -- a cheap file-existence check, not a permission check. */
  supported: boolean;
  /** Whether this platform's helper can honor `NativeRecordingSource.cropFraction` -- macOS only for now, see that field's doc. */
  supportsCrop: boolean;
}

export type NativeRecordingStartResult =
  { ok: true; outputPath: string } | { ok: false; reason: string };

export type NativeRecordingStopResult =
  { ok: true; outputPath: string } | { ok: false; reason: string };
