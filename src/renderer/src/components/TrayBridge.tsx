import { useEffect } from 'react';
import { useToolTabs } from './providers/ToolProvider';
import { openRecorderToolbarFor } from '../../tools/screen-recorder/features/recording/lib/open-recorder-toolbar';

/**
 * Bridges the main process tray menu to the renderer. Either way, focuses
 * (or opens) the Screen Recorder tab and opens the floating recorder-toolbar
 * so it's always ready to go regardless of what tab/tool was showing
 * before; picking a specific source from the tray's menu (see tray.ts)
 * opens the toolbar for that source directly, otherwise it defaults to the
 * primary screen the same way the toolbar's own Display tab does -- not
 * auto-started from the tray click itself, since kicking off a recording
 * with no on-screen confirmation felt like too easy a way to record
 * something by accident.
 *
 * Also owns the tray icon's lifecycle: it only exists (and only clutters
 * the menu bar) while a Screen Recorder tab is actually open, rather than
 * for the app's whole lifetime regardless of use.
 */
export function TrayBridge(): null {
  const { tabs, openTab, selectTab } = useToolTabs();
  const hasRecorderTab = tabs.some((t) => t.type === 'screen-recorder');

  useEffect(() => {
    if (!hasRecorderTab) return;
    void window.screenRecorder.tray.register();
    return () => {
      void window.screenRecorder.tray.unregister();
    };
  }, [hasRecorderTab]);

  useEffect(() => {
    function focusRecorderTab(): void {
      const existing = tabs.find((t) => t.type === 'screen-recorder');
      if (existing) {
        selectTab(existing.id);
      } else {
        openTab('screen-recorder', {}, { title: 'Screen Recording' });
      }
    }

    const unsubscribeOpen = window.screenRecorder.tray.onOpenRecordPicker(() => {
      focusRecorderTab();
      void (async () => {
        const sources = await window.screenRecorder.recording.getCaptureSources();
        // Prefer the primary display -- see ScreenRecorderSidebar.tsx's
        // handleNewRecord for why "the first screen source" isn't safe.
        const defaultSource =
          sources.find((s) => s.type === 'screen' && s.isPrimaryDisplay) ??
          sources.find((s) => s.type === 'screen') ??
          sources[0];
        if (defaultSource) await openRecorderToolbarFor(defaultSource);
      })();
    });
    const unsubscribeSelect = window.screenRecorder.tray.onSourceSelected((source) => {
      focusRecorderTab();
      void openRecorderToolbarFor(source);
    });

    return () => {
      unsubscribeOpen();
      unsubscribeSelect();
    };
  }, [tabs, openTab, selectTab]);

  return null;
}
