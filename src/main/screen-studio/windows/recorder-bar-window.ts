import { BrowserWindow } from 'electron';

// Small always-on-top control bar shown while a recording is active
// (start/stop/pause, mic mute, webcam toggle).
// TODO: implement a frameless, always-on-top HUD window and load the
// `recording-hud` renderer route into it.
let recorderBarWindow: BrowserWindow | null = null;

export function showRecorderBarWindow(): BrowserWindow {
  if (!recorderBarWindow) {
    recorderBarWindow = new BrowserWindow({
      width: 320,
      height: 72,
      frame: false,
      alwaysOnTop: true,
      resizable: false,
      show: false
    });
  }
  return recorderBarWindow;
}

export function hideRecorderBarWindow(): void {
  recorderBarWindow?.hide();
}
