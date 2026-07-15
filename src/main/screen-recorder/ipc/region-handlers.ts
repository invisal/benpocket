import { ipcMain } from 'electron';
import { IpcChannels } from '@shared/ipc-channels';
import type { SelectCaptureRegionOptions } from '@shared/capture-region';
import {
  registerRegionSelectListeners,
  selectCaptureRegion
} from '../windows/region-select-window';

export function registerRegionHandlers(): void {
  registerRegionSelectListeners();
  ipcMain.handle(
    IpcChannels.SelectCaptureRegion,
    (_event, options?: SelectCaptureRegionOptions) => {
      // Screen Capture tool only — fullscreen drag-to-select overlay.
      return selectCaptureRegion(options);
    }
  );
}
