# Adding keybinding actions

A tool doesn't register a _binding_ itself — it registers the _action_ the
user is allowed to bind a key to. The user assigns the accelerator later,
from Home's Keybindings panel; nothing fires until they do.

## Adding actions for a tool

1. In `src/renderer/tools/<tool-name>/keybindings.ts`, export a
   `KeybindingAction[]` (type from `@renderer/types/keybindings`):

   ```ts
   import { Zap } from 'lucide-react';
   import type { KeybindingAction } from '@renderer/types/keybindings';
   import { someToolLevelFunction } from './lib/actions';

   export const myToolKeybindingActions: KeybindingAction[] = [
     {
       id: 'my-tool:do-thing',
       group: 'My Tool',
       actionName: 'Do Thing',
       description: 'One sentence a user picks this action by in the binding dialog.',
       icon: Zap,
       action: () => {
         void someToolLevelFunction();
       }
     }
   ];
   ```

   - `id` — `<tool-name>:kebab-case-action`. Must be globally unique across
     every tool; it's the string persisted in the user's saved bindings, so
     once shipped, don't rename it out from under existing users' bindings
     without a migration.
   - `group` — the tool's display name; the Keybindings panel groups the
     action list by this.
   - `actionName` — short label shown in the binding list/dialog.
   - `description` — one sentence, shown as help text in the assign-a-key dialog.
   - `icon` — optional `LucideIcon`, shown next to the action in the binding
     picker. Pick one per _action_, not one per tool/group — actions in the
     same tool can (and often should) use different icons. Omit it and the
     picker falls back to a generic placeholder.
   - `action` — a plain `() => void` closure (wrap an async fn as
     `void someAsyncFn()`). It fires even when the tool's tab isn't
     mounted/focused — these are OS-level global shortcuts — so it must be
     able to run cold: focus or open the tool's tab itself if it needs the
     UI visible (see `focusOrOpenScreenCapture` / `focusRecorderTab` in the
     reference implementations below), rather than assuming a component is
     already mounted to handle it. If the action needs component/store
     state, read it from a store directly (stores outlive tab mount/unmount).

2. Spread the tool's list into the app-wide registry,
   `src/renderer/src/lib/keybindings.ts`:

   ```ts
   import { myToolKeybindingActions } from '../../tools/my-tool/keybindings';

   export const keybindingActions: KeybindingAction[] = [
     ...screenRecorderKeybindingActions,
     ...screenCaptureKeybindingActions,
     ...myToolKeybindingActions
   ];
   ```

No default/pre-assigned accelerator is set from a tool's `keybindings.ts` —
actions ship unbound; the user opts in by assigning a key themselves in the
Home > Keybindings panel. No main-process or IPC changes are needed per
action.

## Reference implementations

- `src/renderer/tools/screen-capture/keybindings.ts` — two actions, one of
  which special-cases behavior per platform inside `action()` (Wayland's OS
  picker vs. the floating toolbar).
- `src/renderer/tools/screen-recorder/keybindings.ts` — a single action that
  focuses the tool's tab before opening its toolbar.
