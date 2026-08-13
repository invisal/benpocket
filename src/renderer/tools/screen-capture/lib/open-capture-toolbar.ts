import { useCaptureResultStore } from '../store/capture-result.store';

/**
 * Opens the floating capture toolbar without minimizing the main window.
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
