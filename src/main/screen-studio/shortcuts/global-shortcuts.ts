import { globalShortcut } from 'electron';
import { DefaultShortcuts } from '@screen-studio/types/shortcuts';

// TODO: load user-customized bindings from settings-store instead of
// defaults, and wire each action to the appropriate controller (recording,
// webcam, etc.) instead of the current no-op callback.
export function registerGlobalShortcuts(): void {
  for (const binding of DefaultShortcuts) {
    globalShortcut.register(binding.accelerator, () => {
      // TODO: dispatch `binding.action`
    });
  }
}

export function unregisterGlobalShortcuts(): void {
  globalShortcut.unregisterAll();
}
