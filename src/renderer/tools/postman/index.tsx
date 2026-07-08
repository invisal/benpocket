import { ToolComponentProps } from '@renderer/components/providers/createTabProvider';
import { PostmanWorkspace } from './PostmanWorkspace';

interface Props {}

// eslint-disable-next-line no-empty-pattern
export function HttpClientMain({}: ToolComponentProps<Props>) {
  return <PostmanWorkspace />;
}
