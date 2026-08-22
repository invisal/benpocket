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
    // Returns whether the tab actually ended up focused/open -- both
    // `selectTab` and `openTab` can be blocked by the tab's own leave guard
    // (e.g. unsaved editor changes on whatever tab was active before this),
    // in which case callers with a follow-up action (opening the floating
    // recorder toolbar below) must skip it rather than running as if the
    // tab had switched when it didn't.
    function focusRecorderTab(): boolean {
      const existing = tabs.find((t) => t.type === 'screen-recorder');
      if (existing) return selectTab(existing.id);
      return openTab('screen-recorder', {}, { title: 'Screen Recording' }) !== null;
    }

    function focusOrOpenScreenCapture(): boolean {
      const existing = tabs.find((t) => t.type === 'screen-capture');
      if (existing) return selectTab(existing.id);
      return openTab('screen-capture', {}) !== null;
    }

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
  }, [tabs, openTab, selectTab]);

  return null;
}
