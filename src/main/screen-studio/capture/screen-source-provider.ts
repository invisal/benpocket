import { desktopCapturer } from 'electron';
import type { CaptureSource } from '@screen-studio/types/recording';

export async function listCaptureSources(): Promise<CaptureSource[]> {
  const sources = await desktopCapturer.getSources({
    types: ['screen', 'window'],
    thumbnailSize: { width: 320, height: 180 }
  });

  // TODO: filter out ScreenStudio's own windows; map a stable displayId for
  // screen sources so multi-monitor setups can be distinguished reliably.
  return sources.map((source) => ({
    id: source.id,
    name: source.name,
    type: source.id.startsWith('screen') ? 'screen' : 'window',
    thumbnailDataUrl: source.thumbnail.toDataURL()
  }));
}
