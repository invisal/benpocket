import type { JSX } from 'react';
import { ShortcutRecorder } from '../../features/shortcuts/components/ShortcutRecorder';

export function SettingsPage(): JSX.Element {
  return (
    <div className="flex flex-1 flex-col gap-6 p-8">
      <h1 className="text-xl font-semibold">Settings</h1>
      <ShortcutRecorder />
    </div>
  );
}
