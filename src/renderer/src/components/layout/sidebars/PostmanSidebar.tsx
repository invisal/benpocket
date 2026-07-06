import React from 'react';
import { Plus, Send } from 'lucide-react';
import { useLayoutStore } from '../../../store/layout.store';

export const PostmanSidebar: React.FC = () => {
  const { openTab, activeInstanceId } = useLayoutStore();

  const handleNewPostmanRequest = () => {
    const requestId = `postman-req-${Date.now()}`;
    openTab({
      id: requestId,
      title: 'New API Request',
      type: 'postman',
      instanceId: activeInstanceId,
      meta: { method: 'GET', url: 'https://api.github.com/repos/facebook/react' }
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[10px] font-bold tracking-wider text-zinc-500 uppercase">
          Postman Client
        </h3>
        <button
          onClick={handleNewPostmanRequest}
          title="Create Request"
          className="p-1 text-zinc-400 hover:text-white hover:bg-border-dark/60 rounded cursor-pointer transition-colors"
        >
          <Plus size={16} />
        </button>
      </div>

      <button
        onClick={handleNewPostmanRequest}
        className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-editor-bg border border-border-dark hover:bg-border-dark/50 rounded text-xs text-zinc-300 hover:text-white cursor-pointer transition-all"
      >
        <Send size={12} className="text-zinc-500" />
        <span>New Request</span>
      </button>

      {/* Request History */}
      <div className="flex flex-col gap-1">
        <span className="text-[10px] font-semibold text-zinc-500 mt-2">RECENT HISTORY</span>
        <div className="flex flex-col gap-1">
          {[
            { method: 'GET', url: 'https://api.github.com/users', title: 'Github Users' },
            { method: 'POST', url: '/v1/auth/login', title: 'User Login' },
            { method: 'GET', url: '/v1/projects', title: 'Fetch Projects' }
          ].map((hist, i) => (
            <div
              key={i}
              onClick={() =>
                openTab({
                  id: `postman-history-${i}-${activeInstanceId}`,
                  title: hist.title,
                  type: 'postman',
                  instanceId: activeInstanceId,
                  meta: { method: hist.method, url: hist.url }
                })
              }
              className="flex items-center gap-2 p-1.5 bg-editor-bg/40 hover:bg-editor-bg rounded text-xs cursor-pointer border border-transparent hover:border-border-dark transition-all group"
            >
              <span
                className={`text-[9px] font-extrabold px-1 py-0.5 rounded shrink-0 ${
                  hist.method === 'POST'
                    ? 'bg-amber-950/40 text-amber-500'
                    : 'bg-emerald-950/40 text-emerald-500'
                }`}
              >
                {hist.method}
              </span>
              <span className="truncate text-zinc-300 group-hover:text-white">{hist.title}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
