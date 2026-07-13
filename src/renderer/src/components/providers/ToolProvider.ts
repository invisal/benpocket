import { createTabProvider } from './createTabProvider';
import { allTools } from './AllTools';

function createInitialTabs() {
  return [{ type: 'home' as const, payload: {}, title: 'Home', subtitle: '', id: 'home' }];
}

const tools = createTabProvider(allTools, {
  storageKey: 'craftbox-tool-tabs',
  initialTabs: createInitialTabs
});

export const useToolTabs = tools.useTabs;
export const ToolTabContents = tools.TabSwitcher;
