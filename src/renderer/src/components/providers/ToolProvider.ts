import { HttpClientMain } from './../../../tools/postman';
import { HomeMain } from './../../../tools/home';
import { createTabProvider, registerTool } from './createTabProvider';
import { ScreenRecordMain } from '@screen-studio/index';

const homeTool = registerTool({
  name: 'home',
  component: HomeMain,
  generateName: () => 'Home',
  label: ''
});

const httpClientTool = registerTool({
  name: 'http-client',
  component: HttpClientMain,
  generateName: () => 'HTTP Client',
  label: ''
});

const screenRecordTool = registerTool({
  name: 'screen-record',
  component: ScreenRecordMain,
  generateName: () => 'Screen Recorder',
  label: ''
});

const tools = createTabProvider([homeTool, httpClientTool, screenRecordTool]);

export const ToolTabProvider = tools.TabProvider;
export const useToolTabs = tools.useTabs;
export const ToolTabContents = tools.TabSwitcher;
export type ToolTabItem = ReturnType<typeof tools.useTabs>['tabs'][number];
