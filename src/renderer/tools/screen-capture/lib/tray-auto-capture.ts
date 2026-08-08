/** Pending Wayland tray → auto-start Capture (portal picker). */

let armed = false;

/** Call from TrayBridge before opening/focusing the screen-capture tab. */
export function armTrayAutoCapture(): void {
  armed = true;
}

/** True once; clears the arm. ScreenCaptureMain consumes this on mount / IPC. */
export function takeTrayAutoCapture(): boolean {
  if (!armed) return false;
  armed = false;
  return true;
}
