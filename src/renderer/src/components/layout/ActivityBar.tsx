import React from 'react';
import { useToolTabs } from '../providers/ToolProvider';
import { GlobeIcon } from 'lucide-react';
import cn from 'cnfast';

export const ActivityBar: React.FC = () => {
  const { tabs, activeTabId, selectTab } = useToolTabs();

  return (
    <div className="w-12 py-2 bg-surface-3 border-r border-border flex flex-col items-center gap-1">
      {tabs.map((tab) => (
        <button
          className={cn(
            'size-9 flex justify-center items-center rounded-lg cursor-pointer',
            tab.id === activeTabId ? 'bg-surface-5' : 'hover:bg-surface-4'
          )}
          key={tab.id}
          onClick={() => selectTab(tab.id)}
        >
          <GlobeIcon size={16} />
        </button>
      ))}
    </div>
  );
};
