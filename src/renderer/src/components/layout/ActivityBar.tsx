import React from 'react';
import { useToolTabs } from '../providers/ToolProvider';
import { GlobeIcon } from 'lucide-react';
import cn from 'cnfast';
import { ContextMenu } from '../ui/ContextMenu';

export const ActivityBar: React.FC = () => {
  const { tabs, activeTabId, selectTab, closeTab } = useToolTabs();

  return (
    <div className="w-12 py-2 bg-surface-3 border-r border-border flex flex-col items-center gap-1">
      {tabs.map((tab) => (
        <ContextMenu.Root key={tab.id}>
          <ContextMenu.Trigger
            render={
              <button
                className={cn(
                  'size-9 flex justify-center items-center rounded-lg cursor-pointer',
                  tab.id === activeTabId ? 'bg-surface-5' : 'hover:bg-surface-4'
                )}
                onClick={() => selectTab(tab.id)}
              >
                <GlobeIcon size={16} />
              </button>
            }
          />
          <ContextMenu.Content>
            <ContextMenu.Item onClick={() => closeTab(tab.id)}>Close</ContextMenu.Item>
          </ContextMenu.Content>
        </ContextMenu.Root>
      ))}
    </div>
  );
};
