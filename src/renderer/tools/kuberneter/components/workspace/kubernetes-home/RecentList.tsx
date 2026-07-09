import React from 'react';
import { RecentConnection } from '../../../../../src/store/layout.store';
import { Globe } from 'lucide-react';

interface RecentListProps {
  recents: RecentConnection[];
  activeContext: string;
  onConnect: (contextName: string, configPath: string, server?: string) => void;
}

export const RecentList: React.FC<RecentListProps> = ({ recents, activeContext, onConnect }) => {
  return (
    <div className="flex flex-col gap-3 min-h-0 flex-1">
      <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider font-sans">Recent</h3>

      {recents.length === 0 ? (
        <p className="text-[11px] text-zinc-600 pl-1.5 italic">No recent connections.</p>
      ) : (
        <div className="flex flex-col gap-1.5 pl-1.5 overflow-y-auto max-h-[300px] pr-1">
          {recents.map((item) => {
            const isConnected = item.contextName === activeContext;
            return (
              <button
                key={`${item.configPath}-${item.contextName}`}
                onClick={() => onConnect(item.contextName, item.configPath, item.server)}
                className={`w-full flex items-center justify-between py-1.5 px-2 rounded text-left cursor-pointer transition-colors ${
                  isConnected
                    ? 'bg-accent/10 text-white font-semibold'
                    : 'text-zinc-400 hover:bg-surface-2 hover:text-zinc-200'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <Globe
                    className={`size-3.5 shrink-0 ${isConnected ? 'text-accent' : 'text-zinc-500'}`}
                  />
                  <div className="truncate pr-2">
                    <p className="text-xs font-medium truncate">{item.contextName}</p>
                    <p className="text-[9px] text-zinc-500 truncate font-mono">
                      {item.server || 'default-endpoint'}
                    </p>
                  </div>
                </div>

                {isConnected && (
                  <span className="size-2 rounded-full bg-emerald-400 shrink-0 shadow-emerald-500/20 shadow-sm" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
