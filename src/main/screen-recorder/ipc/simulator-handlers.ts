import { ipcMain } from 'electron';
import { IpcChannels } from '@shared/ipc-channels';
import { getBootedSimulatorName } from '../capture/simulator-detection';
import { getAppWindowBounds, type WindowBounds } from '../capture/window-bounds';

/**
 * Re-resolves the booted Simulator's window bounds on demand. Used right
 * before recording actually starts (see cursor-capture.ts) rather than
 * trusting the bounds a `CaptureSource` was tagged with whenever the source
 * list was last loaded/refreshed -- the window can easily have moved or
 * resized in the time between picking it and hitting "Start Recording".
 */
async function refreshSimulatorWindowBounds(): Promise<WindowBounds | null> {
  const bootedSimulatorName = await getBootedSimulatorName();
  if (!bootedSimulatorName) return null;
  return getAppWindowBounds('Simulator');
}

export function registerSimulatorHandlers(): void {
  ipcMain.handle(IpcChannels.GetBootedSimulator, () => getBootedSimulatorName());
  ipcMain.handle(IpcChannels.RefreshSimulatorWindowBounds, () => refreshSimulatorWindowBounds());
}
