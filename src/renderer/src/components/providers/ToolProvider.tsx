import { httpTool } from 'src/renderer/tools/postman';
import { createTabProvider } from './createTabProvider';
import { screenRecordTool } from '@screen-studio/index';

const { TabProvider: ToolTabProvider, useTabs: useToolTabs } = createTabProvider([
  httpTool,
  screenRecordTool
]);

export default { ToolTabProvider, useToolTabs };
