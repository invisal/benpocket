import { useEffect } from 'react';
import { useToolTabs } from './providers/ToolProvider';
import { openRecorderToolbarFor } from '../../tools/screen-recorder/features/recording/lib/open-recorder-toolbar';
import { armTrayAutoCapture } from '../../tools/screen-capture/lib/tray-auto-capture';

/**
 * Bridges the main process tray menu to the renderer. "New Recording" focuses
 * (or opens) the Screen Recorder tab and opens the floating recorder-toolbar.
 * "Screen Capture" opens/focuses that tool tab; on Linux Wayland it also arms
 * auto-Capture so the portal source picker opens immediately.
 */
export function TrayBridge(): null {
  const { tabs, openTab, selectTab } = useToolTabs();

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
      // Arm before openTab — Screen Capture is lazy-loaded; the flag survives
      // until ScreenCaptureMain mounts and consumes it.
      if (window.api?.usesOsCapturePicker) armTrayAutoCapture();
      focusOrOpenScreenCapture();
    });

    return () => {
      unsubscribeOpen();
      unsubscribeSelect();
      unsubscribeTool();
    };
  }, [tabs, openTab, selectTab]);

  return null;
}
