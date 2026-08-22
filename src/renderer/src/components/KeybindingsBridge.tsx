import { useEffect } from 'react';
import { keybindingActions } from '../lib/keybindings';
import { useKeybindingsStore } from '../store/keybindings.store';

/**
 * Loads the user's keybindings on startup and dispatches fired ones (sent by
 * main once its OS-level global shortcut triggers -- see
 * src/main/keybindings/global-shortcuts.ts) to the matching entry in the
 * renderer's action registry (src/renderer/src/lib/keybindings.ts).
 */
export function KeybindingsBridge(): null {
  useEffect(() => {
    void useKeybindingsStore.getState().load();

    return window.keybindings.onFire((actionId) => {
      keybindingActions.find((a) => a.id === actionId)?.action();
    });
  }, []);

  return null;
}
