import React from 'react';
import { useToolTabs } from '../providers/ToolProvider';
import { GlobeIcon, HomeIcon, VideoIcon } from 'lucide-react';
import cn from 'cnfast';
import { ContextMenu } from '../ui/ContextMenu';
import kuberneterIcon from '@renderer/assets/kuberneter-icon.svg';

export const ActivityBar: React.FC = () => {
  const { tabs, activeTabId, selectTab, closeTab } = useToolTabs();

  const renderIcon = (type: string) => {
    switch (type) {
      case 'home':
        return <HomeIcon size={16} />;
      case 'http-client':
        return <GlobeIcon size={16} />;
      case 'screen-recorder':
        return <VideoIcon size={16} />;
      case 'kuberneter':
        return <img src={kuberneterIcon} className="size-5 select-none pointer-events-none" alt="Kuberneter" />;
      default:
        return <GlobeIcon size={16} />;
    }
  };

  return (
    <div className="w-12 py-2 bg-surface-3 border-r border-border flex flex-col items-center gap-1">
      {tabs.map((tab) => (
        <ContextMenu.Root key={tab.id}>
          <ContextMenu.Trigger
            render={
              <button
                className={cn(
                  'size-9 flex justify-center items-center rounded-lg cursor-pointer transition-colors',
                  tab.id === activeTabId ? 'bg-surface-5 text-white' : 'hover:bg-surface-4 text-zinc-400'
                )}
                onClick={() => selectTab(tab.id)}
              >
                {renderIcon(tab.type)}
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
