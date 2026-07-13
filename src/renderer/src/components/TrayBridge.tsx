import { useEffect } from 'react';
import { useToolTabs } from './providers/ToolProvider';
import { useAppStore } from '../../tools/screen-recorder/app/app-store';
import { useRecordingStore } from '../../tools/screen-recorder/features/recording/store/recording-store';

/**
 * Bridges the main process tray menu to the renderer. Either way, focuses
 * (or opens) the Screen Recorder tab and jumps it to the record source
 * picker so it's always ready to go regardless of what tab/tool was
 * showing before; picking a specific source from the tray's menu (see
 * tray.ts) additionally pre-selects it, leaving just one "Start Recording"
 * click to actually begin -- not auto-started from the tray click itself,
 * since kicking off a recording with no on-screen confirmation felt like
 * too easy a way to record something by accident.
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
    function goToRecordSetup(): void {
      const existing = tabs.find((t) => t.type === 'screen-recorder');
      if (existing) {
        selectTab(existing.id);
      } else {
        openTab('screen-recorder', {}, { title: 'Screen Recording' });
      }
      useAppStore.getState().setRoute('record-setup');
    }

    const unsubscribeOpen = window.screenRecorder.tray.onOpenRecordPicker(goToRecordSetup);
    const unsubscribeSelect = window.screenRecorder.tray.onSourceSelected((source) => {
      useRecordingStore.getState().setSelectedSource(source);
      goToRecordSetup();
    });

    return () => {
      unsubscribeOpen();
      unsubscribeSelect();
    };
  }, [tabs, openTab, selectTab]);

  return null;
}
