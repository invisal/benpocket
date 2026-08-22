import { ipcRenderer } from 'electron';
import { IpcChannels } from '@shared/ipc-channels';
import type { KeybindingEntry } from '@shared/keybindings';

export interface KeybindingsApi {
  get: () => Promise<KeybindingEntry[]>;
  set: (bindings: KeybindingEntry[]) => Promise<KeybindingEntry[]>;
  onFire: (callback: (actionId: string) => void) => () => void;
}

export const keybindingsApi: KeybindingsApi = {
  get: () => ipcRenderer.invoke(IpcChannels.KeybindingsGet),
  set: (bindings) => ipcRenderer.invoke(IpcChannels.KeybindingsSet, bindings),
  onFire: (callback) => {
    const listener = (_event: unknown, actionId: string): void => callback(actionId);
    ipcRenderer.on(IpcChannels.KeybindingFire, listener);
    return () => ipcRenderer.removeListener(IpcChannels.KeybindingFire, listener);
  }
};
