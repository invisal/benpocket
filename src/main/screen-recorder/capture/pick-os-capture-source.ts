import { desktopCapturer } from 'electron';
import type { OsPickerSource } from '@shared/os-picker-source';
import { usesOsCapturePicker } from '@shared/uses-os-capture-picker';
import { findDisplayForCapturerId } from './display-for-source';

/** Opens the PipeWire portal once and returns the source the user picked (Linux Wayland only). */
export async function pickOsCaptureSource(monitorOnly: boolean): Promise<OsPickerSource | null> {
  if (!usesOsCapturePicker()) return null;

  const types: Array<'screen' | 'window'> = monitorOnly ? ['screen'] : ['screen', 'window'];
  const sources = await desktopCapturer.getSources({
    types,
    thumbnailSize: { width: 0, height: 0 }
  });

  const source = sources[0];
  if (!source) return null;

  const displayId = source.display_id ? String(source.display_id) : undefined;
  const display = findDisplayForCapturerId(displayId);

  return {
    id: source.id,
    type: source.id.startsWith('screen') ? 'screen' : 'window',
    displayId: display ? String(display.id) : displayId,
    displayBounds: display?.bounds,
    scaleFactor: display?.scaleFactor
  };
}
