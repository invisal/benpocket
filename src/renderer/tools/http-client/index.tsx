import { type ToolComponentProps } from '@renderer/components/providers/createTabProvider';
import { ToolLayout } from '@renderer/components/layout/ToolLayout';
import { Button } from '@renderer/components/ui/Button';
import { Plus } from 'lucide-react';
import { HttpClientWorkspace } from './HttpClientWorkspace';
import { WorkspaceSelector } from './components/WorkspaceSelector';
import { useRequestTabsStore } from './store/tabs.store';

interface Props {}

// eslint-disable-next-line no-empty-pattern
export function HttpClientMain({}: ToolComponentProps<Props>) {
  const openNewRequestTab = useRequestTabsStore((s) => s.openNewRequestTab);

  return (
    <>
      <ToolLayout.Title>
        <div className="titlebar-nodrag inline-flex items-center gap-2">
          <WorkspaceSelector />
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-1.5"
            onClick={() => openNewRequestTab({ method: 'GET', url: '' })}
            title="Create Request"
          >
            <Plus size={14} />
          </Button>
        </div>
      </ToolLayout.Title>
      <HttpClientWorkspace />
    </>
  );
}

export default HttpClientMain;
