import React from 'react';
import { Home, Monitor, Send, Video, X } from 'lucide-react';
import { useLayoutStore } from '../../store/layout.store';

export const ActivityBar: React.FC = () => {
  const { activeInstances, activeInstanceId, setActiveInstanceId, closeActivityInstance } =
    useLayoutStore();

  const appIcons = {
    lens: Monitor,
    postman: Send,
    screenstudio: Video
  };

  return (
    <div className="w-12 bg-activity-bg border-r border-border-dark flex flex-col justify-between items-center py-2 select-none z-30 shrink-0">
      {/* Top Section: Home & Dynamic Instances */}
      <div className="flex flex-col items-center w-full">
        {/* Persistent Home Icon */}
        <button
          onClick={() => setActiveInstanceId('home')}
          title="Home Dashboard"
          className="relative w-12 h-12 flex items-center justify-center cursor-pointer transition-colors text-zinc-500 hover:text-zinc-200 group"
        >
          {/* Left active line indicator */}
          <div
            className={`absolute left-0 w-[2px] bg-accent transition-all duration-150 ${
              activeInstanceId === 'home' ? 'h-7' : 'h-0 group-hover:h-3'
            }`}
          />
          <Home
            size={20}
            className={`transition-transform duration-100 group-active:scale-95 ${
              activeInstanceId === 'home' ? 'text-accent' : ''
            }`}
          />
        </button>

        {activeInstances.length > 0 && <div className="w-8 h-[1px] bg-border-dark my-1.5" />}

        {/* Dynamic App Instances */}
        <div className="flex flex-col items-center w-full gap-1">
          {activeInstances.map((instance) => {
            const InstanceIcon = appIcons[instance.type];
            const isActive = activeInstanceId === instance.id;

            return (
              <div
                key={instance.id}
                className="relative w-12 h-12 flex items-center justify-center group/item"
              >
                <button
                  onClick={() => setActiveInstanceId(instance.id)}
                  title={instance.title}
                  className="w-full h-full flex items-center justify-center cursor-pointer text-zinc-500 hover:text-zinc-200"
                >
                  {/* Left active line indicator */}
                  <div
                    className={`absolute left-0 w-[2px] bg-accent transition-all duration-150 ${
                      isActive ? 'h-7' : 'h-0 group-hover/item:h-3'
                    }`}
                  />
                  <InstanceIcon
                    size={20}
                    className={`transition-transform duration-100 group-active:scale-95 ${
                      isActive ? 'text-accent' : ''
                    }`}
                  />
                </button>

                {/* Tiny Close Button on hover */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    closeActivityInstance(instance.id);
                  }}
                  title={`Close ${instance.title}`}
                  className="absolute top-1.5 right-1.5 w-3.5 h-3.5 bg-sidebar-bg border border-border-dark hover:bg-red-950/20 text-zinc-500 hover:text-red-400 rounded-full flex items-center justify-center cursor-pointer opacity-0 group-hover/item:opacity-100 transition-opacity z-50 duration-150"
                >
                  <X size={8} />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
