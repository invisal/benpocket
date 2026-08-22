import { createTabProvider, useToolContext } from './createTabProvider';
import { allTools } from './AllTools';

function createInitialTabs() {
  return [{ type: 'home' as const, payload: {}, title: 'Home', subtitle: '', id: 'home' }];
}

const tools = createTabProvider(allTools, {
  storageKey: 'craftbox-tool-tabs',
  initialTabs: createInitialTabs,
  onTabActivated: (tool) => window.telemetry.send({ event: 'tool_opened', tool })
});

export const useToolTabs = tools.useTabs;
export const ToolTabContents = tools.TabSwitcher;

// Exposed so callers outside React -- e.g. the keybinding action registry in
// src/renderer/src/lib/keybindings.ts, which runs from a global
// shortcut fire rather than a component -- can open/select tabs imperatively.
export const toolTabsStore = tools.store;

// `openTab`'s generic signature only accepts a registered tool's literal name --
// loosened here since this bridge is meant to accept whatever string a test passes.
type ImperativeOpenTab = NonNullable<Window['devTools']>['openTab'];

if (window.api.isE2E) {
  window.devTools = {
    openTab: (type, payload, options) =>
      (tools.store.getState().openTab as unknown as ImperativeOpenTab)(type, payload, options),
    selectTab: (id) => tools.store.getState().selectTab(id),
    closeTab: (id) => tools.store.getState().closeTab(id),
    getTabs: () => tools.store.getState().tabs
  };
}
export const registerToolLeaveGuard = tools.registerLeaveGuard;
export { useToolContext };
