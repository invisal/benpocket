import { ipcMain } from 'electron';
import { IpcChannels } from '@shared/ipc-channels';
import {
  registerRegionSelectListeners,
  selectCaptureRegion
} from '../windows/region-select-window';

export function registerRegionHandlers(): void {
  registerRegionSelectListeners();
  ipcMain.handle(IpcChannels.SelectCaptureRegion, () => selectCaptureRegion());
}
