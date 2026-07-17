import { registerRecordingHandlers } from './recording-handlers';
import { registerProjectHandlers } from './project-handlers';
import { registerExportHandlers } from './export-handlers';
import { registerSettingsHandlers } from './settings-handlers';
import { registerWindowHandlers } from './window-handlers';
import { registerPermissionsHandlers } from './permissions-handlers';
import { registerDialogHandlers } from './dialog-handlers';
import { registerSimulatorHandlers } from './simulator-handlers';
import { registerRegionHandlers } from './region-handlers';
import { registerRecorderToolbarHandlers } from '../windows/recorder-toolbar-window';
import { registerSourcePickerOverlayHandlers } from '../windows/source-picker-overlay-window';

export function registerIpcHandlers(): void {
  registerRecordingHandlers();
  registerProjectHandlers();
  registerExportHandlers();
  registerSettingsHandlers();
  registerWindowHandlers();
  registerPermissionsHandlers();
  registerDialogHandlers();
  registerSimulatorHandlers();
  registerRegionHandlers();
  registerRecorderToolbarHandlers();
  registerSourcePickerOverlayHandlers();
}
