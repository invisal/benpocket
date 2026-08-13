import { useCaptureResultStore } from '../store/capture-result.store';

/**
 * Opens the floating capture toolbar and minimizes the main window so it
 * isn't in the shot. Re-open from the dock / taskbar to capture BenPocket.
 * Idempotent while the pill is already up -- listing sources happens inside
 * the toolbar so this invoke isn't blocked on thumbnails.
 */
export async function openCaptureToolbarFor(): Promise<void> {
  if (useCaptureResultStore.getState().isToolbarOpen) return;
  useCaptureResultStore.getState().setToolbarOpen(true);
  try {
    await window.screenRecorder.captureToolbar.open();
  } catch (err) {
    useCaptureResultStore.getState().setToolbarOpen(false);
    throw err;
  }
}
