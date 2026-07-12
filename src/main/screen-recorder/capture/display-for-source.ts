import { screen, type Display } from 'electron';

/** Pair a desktopCapturer source with Electron's Display (Linux ids are often truncated). */
export function findDisplayForCapturerId(displayId?: string): Display | undefined {
  if (!displayId) return undefined;

  const displays = screen.getAllDisplays();
  const exact = displays.find((display) => String(display.id) === displayId);
  if (exact) return exact;

  // ponytail: Wayland/X11 often report a 32-bit subset of Display.id (Electron #27732).
  if (process.platform === 'linux') {
    const low = Number(displayId);
    if (Number.isFinite(low)) {
      return displays.find((display) => (Number(display.id) & 0xffffffff) === low);
    }
  }

  return undefined;
}
