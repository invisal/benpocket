import type { JSX } from 'react';
// TODO: minimal always-on-top control bar: elapsed time, pause/stop, mic mute.
// Intended to be loaded into the frameless window created by
// main/windows/recorder-bar-window.ts.
export function RecordingHudPage(): JSX.Element {
  return (
    <div className="flex h-full items-center justify-center gap-4 p-2">
      <span className="text-sm text-white/70">Recording…</span>
    </div>
  );
}
