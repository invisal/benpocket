import { globalShortcut } from 'electron';
import type { BrowserWindow } from 'electron';
import { IpcChannels } from '@shared/ipc-channels';
import { settingsStore } from '../store/settings-store';

/**
 * OS-level "Launch Recorder" shortcut -- fires even when benpocket isn't the
 * focused app, unlike the in-app bindings under features/shortcuts (display
 * only, and would need focus anyway). Reuses the tray's "open record picker"
 * channel so TrayBridge's existing listener (focus/open the Screen Recorder
 * tab, then open the floating toolbar) handles it exactly like a tray click.
 */
export function registerGlobalShortcuts(mainWindow: BrowserWindow): void {
  const binding = settingsStore.get('shortcuts').find((b) => b.id === 'start-stop-recording');
  if (!binding) return;

  const ok = globalShortcut.register(binding.accelerator, () => {
    if (mainWindow.isDestroyed()) return;
    mainWindow.webContents.send(IpcChannels.TrayOpenRecordPicker);
  });

  if (!ok) {
    console.error(`Failed to register global shortcut: ${binding.accelerator}`);
  }
}

export function unregisterGlobalShortcuts(): void {
  globalShortcut.unregisterAll();
}
