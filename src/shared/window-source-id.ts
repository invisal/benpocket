/**
 * Electron's desktopCapturer embeds a window's native handle as
 * `window:<handle>:0` in its source id. Both the renderer (deciding whether
 * to keep following a window's live bounds while recording) and the main
 * process (recording-handlers.ts, resolving that handle to an actual
 * `getWindowBoundsById` query) need to parse the same id, so this is shared
 * rather than reimplemented on each side.
 */
export function parseWindowSourceId(sourceId: string): number | null {
  const match = /^window:(\d+):/.exec(sourceId);
  if (!match) return null;
  const handle = Number(match[1]);
  return Number.isFinite(handle) ? handle : null;
}
