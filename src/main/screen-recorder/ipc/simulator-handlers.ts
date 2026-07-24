import { ipcMain } from 'electron';
import { IpcChannels } from '@shared/ipc-channels';
import { getBootedSimulatorName } from '../capture/simulator-detection';

export function registerSimulatorHandlers(): void {
  ipcMain.handle(IpcChannels.GetBootedSimulator, () => getBootedSimulatorName());
}
