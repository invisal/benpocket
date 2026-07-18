import { session } from 'electron';
import { usesOsCapturePicker } from '@shared/uses-os-capture-picker';

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
 * Routes getDisplayMedia to a native OS picker: the PipeWire portal on
 * Linux Wayland (Screen Capture tool), or ScreenCaptureKit's picker on
 * macOS 15+ (Screen Recorder's "Use System Picker" button). Screen
 * Recorder's main flow uses getUserMedia(chromeMediaSourceId), not
 * getDisplayMedia -- this only covers the opt-in native-picker path.
 */
export function registerDisplayMediaHandler(): void {
  if (usesOsCapturePicker()) {
    session.defaultSession.setDisplayMediaRequestHandler(
      async (_request, callback) => {
        // PipeWire shows its own picker when capture starts — getSources() would
        // open a redundant portal session that can't be reused for the stream.
        callback({ video: { id: 'screen:0:0', name: 'Entire Screen' } });
      },
      { useSystemPicker: true }
    );
    return;
  }

  if (!supportsNativeSystemPicker()) return;

  session.defaultSession.setDisplayMediaRequestHandler(
    // `useSystemPicker: true` means ScreenCaptureKit's own dialog handles
    // source selection whenever it's available, so this callback normally
    // never runs on the macOS 15+ this is gated to. It still has to resolve
    // the request rather than hang if that ever isn't the case.
    (_request, callback) => callback({}),
    { useSystemPicker: true }
  );
}
