import type { CaptureSource } from '@screen-recorder/types/recording';

/**
 * Prefer the primary display over "the first screen source" -- source order
 * from desktopCapturer isn't guaranteed to put the primary display first
 * (see CaptureSource.isPrimaryDisplay's own doc). Falls back to the first
 * screen, then whatever the first source of any kind is.
 */
export function pickDefaultCaptureSource(sources: CaptureSource[]): CaptureSource | null {
  return (
    sources.find((s) => s.type === 'screen' && s.isPrimaryDisplay) ??
    sources.find((s) => s.type === 'screen') ??
    sources[0] ??
    null
  );
}
