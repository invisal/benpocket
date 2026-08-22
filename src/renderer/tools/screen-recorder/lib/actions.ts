import { toolTabsStore } from '@renderer/components/providers/ToolProvider';

// Action helpers shared between TrayBridge (tray menu clicks) and this tool's
// keybindings.ts (global-shortcut fires) -- add more here as either gains
// another shared entry point, rather than one file per function.

/**
 * Focuses (or opens) the Screen Recorder tab. Returns whether the tab
 * actually ended up focused/open -- both `selectTab` and `openTab` can be
 * blocked by the tab's own leave guard (e.g. unsaved editor changes on
 * whatever tab was active before this), in which case callers with a
 * follow-up action (opening the floating recorder toolbar) must skip it
 * rather than running as if the tab had switched when it didn't.
 */
export function focusRecorderTab(): boolean {
  const { tabs, selectTab, openTab } = toolTabsStore.getState();
  const existing = tabs.find((t) => t.type === 'screen-recorder');
  if (existing) return selectTab(existing.id);
  return openTab('screen-recorder', {}, { title: 'Screen Recording' }) !== null;
}
