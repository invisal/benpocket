import { ToolComponentProps } from '@renderer/components/providers/createTabProvider';
import { HttpClientWorkspace } from './HttpClientWorkspace';

interface Props {}

// eslint-disable-next-line no-empty-pattern
export function HttpClientMain({}: ToolComponentProps<Props>) {
  return <HttpClientWorkspace />;
}

export default HttpClientMain;
