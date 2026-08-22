import Store from 'electron-store';
import type { KeybindingEntry } from '@shared/keybindings';

export interface KeybindingsSettings {
  bindings: KeybindingEntry[];
}

// Explicit `name` so this doesn't collide with the default `config.json`
// electron-store file already owned by screen-recorder's unnamed `Store`
// (src/main/screen-recorder/store/settings-store.ts).
export const keybindingsStore = new Store<KeybindingsSettings>({
  name: 'keybindings',
  defaults: { bindings: [] }
});
