import { registerTool } from '@renderer/components/providers/createTabProvider';

export const httpTool = registerTool({
  name: 'http-client',
  component: () => <div />,
  generateName: () => 'HTTP Client',
  label: ''
});
