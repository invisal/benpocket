import { create } from 'zustand';
import type { KeybindingEntry } from '@shared/keybindings';
import { withBinding, withoutBinding } from '@renderer/lib/keybindings-reducer';

interface KeybindingsState {
  bindings: KeybindingEntry[];
  isLoading: boolean;
  load: () => Promise<void>;
  setBinding: (actionId: string, accelerator: string) => Promise<void>;
  removeBinding: (actionId: string) => Promise<void>;
}

// Renderer-side cache of the user's keybindings, persisted in main via
// electron-store (src/main/keybindings/store.ts) and re-registered as OS-level
// global shortcuts on every change (src/main/keybindings/global-shortcuts.ts).
export const useKeybindingsStore = create<KeybindingsState>()((set, get) => ({
  bindings: [],
  isLoading: true,

  load: async () => {
    const bindings = await window.keybindings.get();
    set({ bindings, isLoading: false });
  },

  setBinding: async (actionId, accelerator) => {
    const next = withBinding(get().bindings, actionId, accelerator);
    const saved = await window.keybindings.set(next);
    set({ bindings: saved });
  },

  removeBinding: async (actionId) => {
    const next = withoutBinding(get().bindings, actionId);
    const saved = await window.keybindings.set(next);
    set({ bindings: saved });
  }
}));
