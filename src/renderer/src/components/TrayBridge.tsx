import { useEffect, useRef } from 'react';
import { useToolTabs } from './providers/ToolProvider';
import { openRecorderToolbarFor } from '../../tools/screen-recorder/features/recording/lib/open-recorder-toolbar';
import { openCaptureToolbarFor } from '../../tools/screen-capture/lib/open-capture-toolbar';
import { useScreenCaptureSettings } from '../../tools/screen-capture/lib/use-screen-capture-settings';

/**
 * Bridges the main process tray menu to the renderer. "New Recording" focuses
 * (or opens) the Screen Recorder tab and opens the floating recorder-toolbar.
 * "Screen Capture": pill platforms open the capture toolbar directly; Wayland
 * opens/focuses the tool tab so the user can set a timer before Capture.
 */
export function TrayBridge(): null {
  const { tabs, openTab, selectTab } = useToolTabs();
  const { fields } = useScreenCaptureSettings();
  const delayRef = useRef(fields.delaySeconds);
  useEffect(() => {
    delayRef.current = fields.delaySeconds;
  });

  useEffect(() => {
    function focusRecorderTab(): void {
      const existing = tabs.find((t) => t.type === 'screen-recorder');
      if (existing) {
        selectTab(existing.id);
      } else {
        openTab('screen-recorder', {}, { title: 'Screen Recording' });
      }
    }

    function focusOrOpenScreenCapture(): void {
      const existing = tabs.find((t) => t.type === 'screen-capture');
      if (existing) {
        selectTab(existing.id);
        return;
      }
      openTab('screen-capture', {});
    }

    const unsubscribeOpen = window.screenRecorder.tray.onOpenRecordPicker(() => {
      focusRecorderTab();
      // No source passed -- opens immediately instead of waiting on a full
      // capture-sources fetch; the toolbar picks its own default once its
      // own fetch resolves. See openRecorderToolbarFor's doc.
      void openRecorderToolbarFor();
    });
    const unsubscribeSelect = window.screenRecorder.tray.onSourceSelected((source) => {
      focusRecorderTab();
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
  }, [tabs, openTab, selectTab]);

  return null;
}
