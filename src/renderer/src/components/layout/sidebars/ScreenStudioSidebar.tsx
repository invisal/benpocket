import React from 'react';
import { Plus, Play, Mic, MousePointer, Film } from 'lucide-react';
import { useLayoutStore } from '../../../store/layout.store';

export const ScreenStudioSidebar: React.FC = () => {
  const { openTab, activeInstanceId } = useLayoutStore();

  const handleNewScreenStudioSession = () => {
    const sessionId = `screenstudio-session-${Date.now()}`;
    openTab({
      id: sessionId,
      title: 'Screen Recording',
      type: 'screenstudio',
      instanceId: activeInstanceId,
      meta: { source: 'Screen 1', resolution: '1080p' }
    });
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Config header */}
      <div className="flex items-center justify-between">
        <h3 className="text-[10px] font-bold tracking-wider text-zinc-500 uppercase">
          ScreenStudio
        </h3>
        <button
          onClick={handleNewScreenStudioSession}
          title="New Session"
          className="p-1 text-zinc-400 hover:text-white hover:bg-border-dark/60 rounded cursor-pointer transition-colors"
        >
          <Plus size={16} />
        </button>
      </div>

      <button
        onClick={handleNewScreenStudioSession}
        className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-editor-bg border border-border-dark hover:bg-border-dark/50 rounded text-xs text-zinc-300 hover:text-white cursor-pointer transition-all"
      >
        <Play size={12} className="text-zinc-500" />
        <span>Launch Studio</span>
      </button>

      {/* Config mockups */}
      <div className="flex flex-col gap-2 bg-editor-bg/40 p-2.5 border border-border-dark rounded-lg text-xs">
        <span className="text-[10px] font-bold text-zinc-500">DEFAULT CAPTURE PROFILE</span>

        <div className="flex flex-col gap-1 mt-1">
          <span className="text-[10px] text-zinc-500">Audio Sources</span>
          <label className="flex items-center gap-2 text-zinc-300">
            <input type="checkbox" defaultChecked className="rounded accent-accent" />
            <Mic size={12} />
            <span>Microphone</span>
          </label>
          <label className="flex items-center gap-2 text-zinc-300">
            <input type="checkbox" defaultChecked className="rounded accent-accent" />
            <span>System Audio</span>
          </label>
        </div>

        <div className="flex flex-col gap-1 mt-2">
          <span className="text-[10px] text-zinc-500">Effects</span>
          <label className="flex items-center gap-2 text-zinc-300">
            <input type="checkbox" defaultChecked className="rounded accent-accent" />
            <MousePointer size={12} />
            <span>Highlight Clicks</span>
          </label>
        </div>
      </div>

      {/* Recent records */}
      <div className="flex flex-col gap-1">
        <span className="text-[10px] font-semibold text-zinc-500 mt-2">RECENT EXPORTS</span>
        <div className="flex flex-col gap-1">
          {['Demo_Video_01.mp4', 'Feature_Promo_draft.mp4'].map((video, idx) => (
            <div
              key={idx}
              onClick={() =>
                openTab({
                  id: `screenstudio-video-${idx}-${activeInstanceId}`,
                  title: video,
                  type: 'screenstudio',
                  instanceId: activeInstanceId,
                  meta: { isVideo: true, name: video }
                })
              }
              className="flex items-center gap-2 p-1.5 hover:bg-editor-bg/50 rounded text-xs cursor-pointer text-zinc-400 hover:text-white transition-colors"
            >
              <Film size={14} className="text-zinc-650 shrink-0" />
              <span className="truncate">{video}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
