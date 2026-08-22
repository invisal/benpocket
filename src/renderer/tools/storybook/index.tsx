import { type ToolComponentProps } from '@renderer/components/providers/createTabProvider';
import { ToolLayout } from '@renderer/components/layout/ToolLayout';
import { StorybookWorkspace } from './StorybookWorkspace';

interface Props {}

// eslint-disable-next-line no-empty-pattern
export function StorybookMain({}: ToolComponentProps<Props>) {
  return (
    <>
      <ToolLayout.Title>Storybook</ToolLayout.Title>
      <StorybookWorkspace />
    </>
  );
}

export default StorybookMain;
