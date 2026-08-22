import type { KeybindingAction } from '@renderer/types/keybindings';
import { screenRecorderKeybindingActions } from '../../tools/screen-recorder/keybindings';
import { screenCaptureKeybindingActions } from '../../tools/screen-capture/keybindings';

/**
 * The app-wide registry of actions that can be bound to a keybinding.
 * Add a tool's own action list here as it grows a keybindings.ts.
 */
export const keybindingActions: KeybindingAction[] = [
  ...screenRecorderKeybindingActions,
  ...screenCaptureKeybindingActions
];
