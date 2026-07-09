import { ToolComponentProps } from '@renderer/components/providers/createTabProvider';
import { ScreenRecorderApp } from './ScreenRecorderApp';

interface Props {}

// eslint-disable-next-line no-empty-pattern
export function ScreenRecordMain({}: ToolComponentProps<Props>) {
  return <ScreenRecorderApp />;
}

export default ScreenRecordMain;
