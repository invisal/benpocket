/**
 * Linux Wayland/PipeWire cannot enumerate sources via desktopCapturer.getSources.
 * X11 can, so it uses the floating capture pill like macOS/Windows.
 */
export function usesOsCapturePicker(
  platform: NodeJS.Platform = process.platform,
  env: NodeJS.ProcessEnv = process.env
): boolean {
  return (
    platform === 'linux' && (Boolean(env.WAYLAND_DISPLAY) || env.XDG_SESSION_TYPE === 'wayland')
  );
}
