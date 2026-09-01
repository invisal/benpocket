import type { JSX } from 'react';
import type { ToolbarError } from '../types/toolbar';

export function RecorderToolbarErrorBanner({
  error
}: {
  error: ToolbarError | null;
}): JSX.Element | null {
  if (!error) return null;
  return (
    <div className="flex flex-col items-center gap-1.5 rounded-2xl bg-surface/95 px-4 py-2.5 text-center shadow-[0_0_28px_rgba(0,0,0,0.3)] backdrop-blur">
      <p className="text-sm text-red-400">{error.message}</p>
      {error.openSettings && (
        <button
          onClick={error.openSettings}
          className="text-[11px] font-medium text-accent underline-offset-2 hover:underline"
        >
          {error.settingsLabel ?? 'Open System Settings'}
        </button>
      )}
    </div>
  );
}
