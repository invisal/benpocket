import type { JSX } from 'react';
import { useShortcutsStore } from '../store/shortcuts-store';

// TODO: click-to-record key combo UI - listen for keydown, build an
// accelerator string, validate for conflicts, then persist via
// screenRecorder.settings.set and re-register in main/shortcuts/global-shortcuts.ts.
export function ShortcutRecorder(): JSX.Element {
  const { bindings } = useShortcutsStore();

  return (
    <div className="flex flex-col gap-2 text-xs">
      {bindings.map((binding) => (
        <div
          key={binding.id}
          className="flex items-center justify-between rounded-lg bg-surface-raised px-3 py-2"
        >
          <span>{binding.action}</span>
          <kbd className="rounded bg-white/10 px-2 py-1">{binding.accelerator}</kbd>
        </div>
      ))}
    </div>
  );
}
