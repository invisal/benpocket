import { globalShortcut } from 'electron';
import { IpcChannels } from '@shared/ipc-channels';
import type { KeybindingEntry } from '@shared/keybindings';
import { sendToMainWindow } from '../tray';

/**
 * Registers every user-configured keybinding as an OS-level global shortcut
 * -- fires even when benpocket isn't the focused app. Only the accelerator
 * is known to the main process; the actual action lives in the renderer's
 * action registry (src/renderer/src/lib/keybindings.ts), looked up by
 * `actionId` once the fire event reaches it.
 */
export function registerAllShortcuts(bindings: KeybindingEntry[]): void {
  globalShortcut.unregisterAll();

  for (const { actionId, accelerator } of bindings) {
    const ok = globalShortcut.register(accelerator, () => {
      sendToMainWindow(IpcChannels.KeybindingFire, actionId);
    });
    if (!ok) {
      console.error(`Failed to register keybinding "${accelerator}" for ${actionId}`);
    }
  }
}

export function unregisterAllShortcuts(): void {
  globalShortcut.unregisterAll();
}
