import { session } from 'electron';

/**
 * macOS 15+ can hand `getDisplayMedia()` off to the real ScreenCaptureKit
 * picker dialog instead of our own UI -- see Electron's `useSystemPicker`.
 * Older macOS has no such picker, so Screen Recorder's "Use System Picker"
 * button is gated on this too (checked via IPC before it's ever shown), and
 * this stays false there rather than registering a handler nothing can use.
 */
export function supportsNativeSystemPicker(): boolean {
  if (process.platform !== 'darwin') return false;
  const [major] = process.getSystemVersion().split('.').map(Number);
  return Number.isFinite(major) && major >= 15;
}

/**
 * Routes getDisplayMedia to ScreenCaptureKit's picker on macOS 15+ (Screen
 * Recorder's "Use System Picker" button). Screen Recorder's main flow uses
 * getUserMedia(chromeMediaSourceId), not getDisplayMedia -- this only covers
 * the opt-in native-picker path. (A getDisplayMedia()-based main flow was
 * tried and reverted -- it's the only capture path Chromium honors a
 * cursor-hiding constraint on, but it drove CPU/thermal noticeably higher
 * over a multi-minute recording than this legacy path, which isn't worth
 * trading for hiding the native pointer.) Linux Wayland no longer registers
 * anything here: Screen Capture goes through the xdg-desktop-portal
 * Screenshot D-Bus call (capture/portal-screenshot.ts) instead of
 * getDisplayMedia/PipeWire.
 */
export function registerDisplayMediaHandler(): void {
  if (!supportsNativeSystemPicker()) return;

  session.defaultSession.setDisplayMediaRequestHandler((_request, callback) => callback({}), {
    useSystemPicker: true
  });
}
