import type React from 'react';
import { Layout } from 'lucide-react';
import { useLayoutStore } from '../../store/layout.store';

export const StatusBar: React.FC = () => {
  const { activeInstances, activeInstanceId } = useLayoutStore();

  const currentInstance = activeInstances.find((i) => i.id === activeInstanceId);
  const statusLabel = currentInstance ? currentInstance.title : 'Home Dashboard';

  return (
    <div className="h-5 bg-status-bg border-t border-border-dark text-text-dim flex items-center justify-between px-2 text-[10px] select-none shrink-0 z-30">
      <div className="flex items-center gap-1.5 px-1.5 py-0.5 text-zinc-400">
        <Layout size={10.5} />
        <span>{statusLabel}</span>
      </div>
    </div>
  );
};
