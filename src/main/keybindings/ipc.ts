import { ipcMain } from 'electron';
import { IpcChannels } from '@shared/ipc-channels';
import type { KeybindingEntry } from '@shared/keybindings';
import { keybindingsStore } from './store';
import { registerAllShortcuts } from './global-shortcuts';

export function registerKeybindingsHandlers(): void {
  ipcMain.handle(IpcChannels.KeybindingsGet, () => keybindingsStore.get('bindings'));

  ipcMain.handle(IpcChannels.KeybindingsSet, (_event, bindings: KeybindingEntry[]) => {
    keybindingsStore.set('bindings', bindings);
    registerAllShortcuts(bindings);
    return keybindingsStore.get('bindings');
  });
}
