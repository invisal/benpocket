import { useEffect } from 'react';
import { useToolTabs } from './providers/ToolProvider';
import { openRecorderToolbarFor } from '../../tools/screen-recorder/features/recording/lib/open-recorder-toolbar';
import { useLayoutStore } from '../store/layout.store';

type TrayToolName =
  | 'file-explorer'
  | 'http-client'
  | 'kuberneter'
  | 'screen-recorder'
  | 'screen-capture'
  | 'storybook';

/**
 * Bridges the main process tray menu to the renderer. Left-click "New
 * Recording" focuses (or opens) the Screen Recorder tab and opens the
 * floating recorder-toolbar. Right-click tool items show the window and
 * open/focus the matching tool tab.
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
      openToolFromTray(tool as TrayToolName, { tabs, openTab, selectTab });
    });

    return () => {
      unsubscribeOpen();
      unsubscribeSelect();
      unsubscribeTool();
    };
  }, [tabs, openTab, selectTab]);

  return null;
}

function openToolFromTray(
  tool: TrayToolName,
  ctx: {
    tabs: ReturnType<typeof useToolTabs>['tabs'];
    openTab: ReturnType<typeof useToolTabs>['openTab'];
    selectTab: ReturnType<typeof useToolTabs>['selectTab'];
  }
): void {
  const { tabs, openTab, selectTab } = ctx;

  const focusOrOpen = (type: TrayToolName, open: () => void): void => {
    const existing = tabs.find((t) => t.type === type);
    if (existing) {
      selectTab(existing.id);
      return;
    }
    open();
  };

  switch (tool) {
    case 'file-explorer':
      focusOrOpen('file-explorer', () => openTab('file-explorer', {}));
      break;
    case 'http-client':
      focusOrOpen('http-client', () => openTab('http-client', {}));
      break;
    case 'screen-recorder':
      focusOrOpen('screen-recorder', () =>
        openTab('screen-recorder', {}, { title: 'Screen Recording' })
      );
      break;
    case 'screen-capture':
      focusOrOpen('screen-capture', () => openTab('screen-capture', {}));
      break;
    case 'storybook':
      focusOrOpen('storybook', () => openTab('storybook', {}));
      break;
    case 'kuberneter':
      focusOrOpen('kuberneter', () => {
        const instanceId = `kuberneter-${Date.now()}`;
        useLayoutStore
          .getState()
          .addActivityInstance('kuberneter', instanceId, { configPath: 'default', cluster: '' });
        openTab('kuberneter', { instanceId });
      });
      break;
  }
}
