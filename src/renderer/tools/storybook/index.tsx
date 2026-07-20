import { type ToolComponentProps } from '@renderer/components/providers/createTabProvider';
import { StorybookWorkspace } from './StorybookWorkspace';

interface Props {}

// eslint-disable-next-line no-empty-pattern
export function StorybookMain({}: ToolComponentProps<Props>) {
  return <StorybookWorkspace />;
}

export default StorybookMain;
