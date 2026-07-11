import { desktopCapturer, screen } from 'electron';
import type { CaptureSource } from '@screen-recorder/types/recording';

export async function listCaptureSources(): Promise<CaptureSource[]> {
  const sources = await desktopCapturer.getSources({
    types: ['screen', 'window'],
    thumbnailSize: { width: 320, height: 180 }
  });

  // `source.display_id` corresponds directly to `Display.id` from the Screen
  // API (Electron's own docs: "a unique identifier that will correspond to
  // the `id` of the matching Display") -- the correct way to pair a screen
  // source with its bounds. Falls back to index-order matching only if a
  // platform ever reports an empty `display_id` (documented as possible).
  const displays = screen.getAllDisplays();
  let fallbackIndex = 0;

  // TODO: filter out ScreenStudio's own windows from the 'window' sources.
  return sources.map((source) => {
    const type = source.id.startsWith('screen') ? 'screen' : 'window';
    if (type !== 'screen') {
      return {
        id: source.id,
        name: source.name,
        type,
        thumbnailDataUrl: source.thumbnail.toDataURL()
      };
    }

    const display =
      displays.find((d) => source.display_id && String(d.id) === source.display_id) ??
      displays[fallbackIndex];
    fallbackIndex += 1;

    return {
      id: source.id,
      name: source.name,
      type,
      thumbnailDataUrl: source.thumbnail.toDataURL(),
      displayId: display ? String(display.id) : undefined,
      displayBounds: display?.bounds
    };
  });
}
