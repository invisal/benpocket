import { session } from 'electron';
import { usesOsCapturePicker } from '@shared/uses-os-capture-picker';

/** Routes getDisplayMedia to the PipeWire portal (Linux Wayland only — Screen Capture). */
export function registerDisplayMediaHandler(): void {
  // Screen Recorder uses getUserMedia(chromeMediaSourceId), not getDisplayMedia.
  // Only register on Wayland where Screen Capture needs the portal path.
  if (!usesOsCapturePicker()) return;

  session.defaultSession.setDisplayMediaRequestHandler(
    async (_request, callback) => {
      // PipeWire shows its own picker when capture starts — getSources() would
      // open a redundant portal session that can't be reused for the stream.
      callback({ video: { id: 'screen:0:0', name: 'Entire Screen' } });
    },
    { useSystemPicker: true }
  );
}
