import type { JSX } from 'react';
import { useShortcutsStore } from '../store/shortcuts-store';
import { SettingsRow } from '../../../components/ui/settings-row';

// TODO: click-to-record key combo UI - listen for keydown, build an
// accelerator string, validate for conflicts, then persist via
// screenRecorder.settings.set and re-register in
// main/screen-recorder/shortcuts/global-shortcuts.ts (currently registered
// once at startup from the stored default).
export function ShortcutRecorder(): JSX.Element {
  const { bindings } = useShortcutsStore();

  return (
    <>
      {bindings.map((binding) => (
        <SettingsRow key={binding.id} title={binding.action}>
          <kbd className="rounded bg-surface-3 px-2 py-1 text-xs">{binding.accelerator}</kbd>
        </SettingsRow>
      ))}
    </>
  );
}
