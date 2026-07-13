import type React from 'react';
import { Layout } from 'lucide-react';
import { useLayoutStore } from '../../store/layout.store';

export const StatusBar: React.FC = () => {
  const { isLeftPanelOpen, toggleLeftPanel, activeInstances, activeInstanceId } = useLayoutStore();

  const currentInstance = activeInstances.find((i) => i.id === activeInstanceId);
  const statusLabel = currentInstance ? currentInstance.title : 'Home Dashboard';

  return (
    <div className="h-5 bg-status-bg border-t border-border-dark text-text-dim flex items-center justify-between px-2 text-[10px] select-none shrink-0 z-30">
      {/* Left side: Active view context */}
      <div className="flex items-center gap-3">
        <button
          onClick={toggleLeftPanel}
          title="Toggle Left Sidebar"
          className={`flex items-center gap-1.5 px-1.5 py-0.5 hover:bg-border-dark/60 hover:text-white cursor-pointer rounded transition-colors border-none bg-transparent ${
            isLeftPanelOpen && activeInstanceId !== 'home' ? 'bg-border-dark/30 text-white' : ''
          }`}
        >
          <Layout size={10.5} />
          <span>{statusLabel}</span>
        </button>
      </div>
    </div>
  );
};
