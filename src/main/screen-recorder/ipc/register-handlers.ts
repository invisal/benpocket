import { registerRecordingHandlers } from './recording-handlers';
import { registerProjectHandlers } from './project-handlers';
import { registerExportHandlers } from './export-handlers';
import { registerSettingsHandlers } from './settings-handlers';
import { registerWindowHandlers } from './window-handlers';
import { registerPermissionsHandlers } from './permissions-handlers';
import { registerDialogHandlers } from './dialog-handlers';
import { registerSimulatorHandlers } from './simulator-handlers';

export function registerIpcHandlers(): void {
  registerRecordingHandlers();
  registerProjectHandlers();
  registerExportHandlers();
  registerSettingsHandlers();
  registerWindowHandlers();
  registerPermissionsHandlers();
  registerDialogHandlers();
  registerSimulatorHandlers();
}
