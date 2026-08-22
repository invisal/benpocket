import { useEffect, useRef } from 'react';
import { openRecorderToolbarFor } from '../../tools/screen-recorder/features/recording/lib/open-recorder-toolbar';
import { focusRecorderTab } from '../../tools/screen-recorder/lib/actions';
import { openCaptureToolbarFor } from '../../tools/screen-capture/lib/open-capture-toolbar';
import { focusOrOpenScreenCapture } from '../../tools/screen-capture/lib/actions';
import { useScreenCaptureSettings } from '../../tools/screen-capture/lib/use-screen-capture-settings';

/**
 * Bridges the main process tray menu to the renderer. "New Recording" focuses
 * (or opens) the Screen Recorder tab and opens the floating recorder-toolbar.
 * "Screen Capture": pill platforms open the capture toolbar directly; Wayland
 * opens/focuses the tool tab so the user can set a timer before Capture.
 */
export function TrayBridge(): null {
  const { fields } = useScreenCaptureSettings();
  const delayRef = useRef(fields.delaySeconds);
  useEffect(() => {
    delayRef.current = fields.delaySeconds;
  });

  useEffect(() => {
    const unsubscribeOpen = window.screenRecorder.tray.onOpenRecordPicker(() => {
      if (!focusRecorderTab()) return;
      // No source passed -- opens immediately instead of waiting on a full
      // capture-sources fetch; the toolbar picks its own default once its
      // own fetch resolves. See openRecorderToolbarFor's doc.
      void openRecorderToolbarFor();
    });
    const unsubscribeSelect = window.screenRecorder.tray.onSourceSelected((source) => {
      if (!focusRecorderTab()) return;
      void openRecorderToolbarFor(source);
    });

    const unsubscribeTool = window.screenRecorder.tray.onOpenTool((tool) => {
      if (tool !== 'screen-capture') return;
      if (window.api?.usesOsCapturePicker) {
        focusOrOpenScreenCapture();
        return;
      }
      void openCaptureToolbarFor(delayRef.current);
    });

    return () => {
      unsubscribeOpen();
      unsubscribeSelect();
      unsubscribeTool();
    };
  }, []);

  return null;
}
