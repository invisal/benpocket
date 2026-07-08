import { ToolComponentProps } from '@renderer/components/providers/createTabProvider';
import { ScreenStudioApp } from './ScreenStudioApp';

interface Props {}

// eslint-disable-next-line no-empty-pattern
export function ScreenRecordMain({}: ToolComponentProps<Props>) {
  return <ScreenStudioApp />;
}
