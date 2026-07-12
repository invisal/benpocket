/** Linux Wayland/PipeWire cannot enumerate sources via desktopCapturer.getSources. */
export function usesOsCapturePicker(): boolean {
  return (
    process.platform === 'linux' &&
    (Boolean(process.env.WAYLAND_DISPLAY) || process.env.XDG_SESSION_TYPE === 'wayland')
  );
}
