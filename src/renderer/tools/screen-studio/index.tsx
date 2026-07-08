import { registerTool } from '@renderer/components/providers/createTabProvider';

export const screenRecordTool = registerTool({
  name: 'screen-record',
  component: () => <div />,
  generateName: () => 'Screen Recorder',
  label: ''
});
