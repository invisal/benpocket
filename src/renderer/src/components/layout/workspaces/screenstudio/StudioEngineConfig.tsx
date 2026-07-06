import React from 'react';
import { Settings2, CheckCircle2 } from 'lucide-react';

interface StudioEngineConfigProps {
  zoomSpeed: number;
  setZoomSpeed: (speed: number) => void;
  studioBackground: string;
  setStudioBackground: (bg: string) => void;
}

export const StudioEngineConfig: React.FC<StudioEngineConfigProps> = ({
  zoomSpeed,
  setZoomSpeed,
  studioBackground,
  setStudioBackground
}) => {
  return (
    <div className="w-full md:w-64 flex flex-col gap-3 shrink-0 select-none">
      <div className="bg-sidebar-bg border border-border-dark rounded-lg p-3.5 flex flex-col gap-3">
        <div className="flex items-center gap-1.5 text-accent">
          <Settings2 size={14} />
          <span className="text-xs font-bold uppercase tracking-wider">Studio Engine</span>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-[10px] text-zinc-555">
            ZOOM LEVEL ON MOUSE CLICK ({zoomSpeed}%)
          </span>
          <input
            type="range"
            min="10"
            max="100"
            value={zoomSpeed}
            onChange={(e) => setZoomSpeed(Number(e.target.value))}
            className="w-full accent-accent bg-editor-bg rounded h-1 cursor-pointer"
          />
        </div>

        <div className="flex flex-col gap-1.5 mt-1">
          <span className="text-[10px] text-zinc-555">STUDIO CANVAS BACKDROP</span>
          <div className="flex gap-2">
            <button
              onClick={() => setStudioBackground('violet')}
              className={`w-7 h-7 rounded-full bg-purple-600 cursor-pointer border-2 transition-all ${
                studioBackground === 'violet'
                  ? 'border-accent scale-105'
                  : 'border-transparent hover:scale-105'
              }`}
            />
            <button
              onClick={() => setStudioBackground('dark')}
              className={`w-7 h-7 rounded-full bg-border-dark cursor-pointer border-2 transition-all ${
                studioBackground === 'dark'
                  ? 'border-accent scale-105'
                  : 'border-transparent hover:scale-105'
              }`}
            />
          </div>
        </div>
      </div>

      <div className="bg-sidebar-bg border border-border-dark rounded-lg p-3.5 flex flex-col gap-2">
        <span className="text-[10px] font-bold text-zinc-550">EXPORTS PROFILE PRESETS</span>
        <div className="flex flex-col gap-1.5">
          {[
            'Twitter / X (16:9 Portrait)',
            'TikTok Short (9:16 vertical)',
            'YouTube FHD (1080p Standard)'
          ].map((preset, i) => (
            <div
              key={i}
              className="p-1.5 bg-editor-bg border border-border-dark hover:bg-border-dark/50 rounded text-[10px] text-zinc-300 flex items-center justify-between cursor-pointer transition-all"
            >
              <span>{preset}</span>
              <CheckCircle2 size={12} className="text-zinc-650 hover:text-emerald-500" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
