import { type ToolComponentProps } from '@renderer/components/providers/createTabProvider';
import { ToolLayout } from '@renderer/components/layout/ToolLayout';
import { HttpClientWorkspace } from './HttpClientWorkspace';

interface Props {}

// eslint-disable-next-line no-empty-pattern
export function HttpClientMain({}: ToolComponentProps<Props>) {
  return (
    <>
      <ToolLayout.Title>HTTP Client</ToolLayout.Title>
      <HttpClientWorkspace />
    </>
  );
}

export default HttpClientMain;
