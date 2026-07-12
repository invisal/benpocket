import { desktopCapturer, screen } from 'electron';
import type { CaptureSource } from '@screen-recorder/types/recording';
import { getBootedSimulatorName } from './simulator-detection';
import { getAppWindowBounds } from './window-bounds';

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

  // If a Simulator is booted, its window source gets tagged with real
  // on-screen bounds (see window-bounds.ts) so it gets the same cursor/click
  // tracking a 'screen' source does. Fetched once up front (not per source)
  // since it doesn't depend on which source is currently being mapped.
  const bootedSimulatorName = await getBootedSimulatorName();
  const simulatorWindowBounds = bootedSimulatorName ? await getAppWindowBounds('Simulator') : null;
  let matchedSimulatorWindow = false;

  // TODO: filter out ScreenStudio's own windows from the 'window' sources.
  const result: CaptureSource[] = sources.map((source) => {
    const type = source.id.startsWith('screen') ? 'screen' : 'window';
    if (type !== 'screen') {
      const isSimulatorWindow =
        bootedSimulatorName !== null && source.name.includes(bootedSimulatorName);
      if (isSimulatorWindow) matchedSimulatorWindow = true;
      return {
        id: source.id,
        name: source.name,
        type,
        thumbnailDataUrl: source.thumbnail.toDataURL(),
        displayBounds: isSimulatorWindow ? (simulatorWindowBounds ?? undefined) : undefined
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

  if (bootedSimulatorName && !matchedSimulatorWindow) {
    console.warn(
      '[screen-source-provider] booted simulator is',
      bootedSimulatorName,
      'but no window source name contained it. Window names seen:',
      sources.filter((s) => !s.id.startsWith('screen')).map((s) => s.name)
    );
  } else if (bootedSimulatorName && !simulatorWindowBounds) {
    console.warn(
      '[screen-source-provider] matched the Simulator window but getAppWindowBounds returned null -- see [window-bounds] log above for why.'
    );
  }

  return result;
}
