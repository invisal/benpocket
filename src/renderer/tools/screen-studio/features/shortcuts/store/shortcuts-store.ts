import { create } from 'zustand';
import { DefaultShortcuts, type ShortcutBinding } from '@screen-studio/types/shortcuts';

interface ShortcutsStoreState {
  bindings: ShortcutBinding[];
  updateBinding: (id: string, accelerator: string) => void;
}

export const useShortcutsStore = create<ShortcutsStoreState>((set) => ({
  bindings: DefaultShortcuts,
  updateBinding: (id, accelerator) =>
    set((state) => ({
      bindings: state.bindings.map((b) => (b.id === id ? { ...b, accelerator } : b))
    }))
}));
