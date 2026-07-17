import type React from 'react';
import { type PriorityClassData } from '../../../types/PriorityClassData';

interface PriorityClassDetailProps {
  payload: PriorityClassData;
  isTab?: boolean;
}

export const PriorityClassDetail: React.FC<PriorityClassDetailProps> = ({
  payload,
  isTab = false
}) => {
  if (!payload) {
    return <div className="p-4 text-xs text-zinc-500">No PriorityClass details available.</div>;
  }

  const labels = payload.labels ? Object.entries(payload.labels) : [];
  const annotations = payload.annotations ? Object.entries(payload.annotations) : [];

  return (
    <div className={`flex flex-col gap-4 ${isTab ? 'p-6 h-full overflow-y-auto' : 'flex-1'}`}>
      {/* Properties Section */}
      <div className="flex flex-col gap-2.5 mt-1">
        <span className="text-[10px] font-bold text-zinc-450 uppercase tracking-wider mb-1">
          Properties
        </span>
        <div className="flex flex-col gap-2.5 text-xs text-zinc-350 bg-surface-2/40 border border-border/40 rounded-lg p-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] text-zinc-555 uppercase">Created</span>
            <span className="font-mono text-zinc-300">
              {payload.age} ago ({payload.createdTime || 'N/A'})
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] text-zinc-555 uppercase">Name</span>
            <span className="font-mono text-zinc-200 break-all">{payload.name}</span>
          </div>
          {payload.description && (
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] text-zinc-555 uppercase">Description</span>
              <span className="text-zinc-300 font-sans">{payload.description}</span>
            </div>
          )}
          {annotations.length > 0 && (
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] text-zinc-555 uppercase">Annotations</span>
              <div className="flex flex-col gap-1 max-h-24 overflow-y-auto mt-0.5 pr-1 select-text">
                {annotations.map(([k, v]) => (
                  <div
                    key={k}
                    className="font-mono text-[10px] text-zinc-400 bg-editor-bg px-2 py-1 rounded border border-border-dark/60 truncate"
                    title={`${k}=${v}`}
                  >
                    {k}={v}
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="flex flex-col gap-0.5 border-t border-border/20 pt-2">
            <span className="text-[10px] text-zinc-555 uppercase">Value</span>
            <span className="font-mono text-zinc-300">{payload.value}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] text-zinc-555 uppercase">Global Default</span>
            <span className="font-mono text-zinc-300">
              {payload.globalDefault ? 'true' : 'false'}
            </span>
          </div>
        </div>
      </div>

      {/* Labels */}
      {labels.length > 0 && (
        <div className="flex flex-col gap-1.5 border-t border-border-dark/60 pt-3">
          <span className="text-[10px] font-bold text-zinc-455 uppercase tracking-wider">
            Labels
          </span>
          <div className="flex flex-wrap gap-1">
            {labels.map(([k, v]) => (
              <span
                key={k}
                className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-surface-2 border border-border text-zinc-300 break-all"
              >
                {k}: {v}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Events Section */}
      <div className="flex flex-col gap-1.5 mt-2 border-t border-border-dark/60 pt-3">
        <span className="text-[10px] font-bold text-zinc-450 uppercase tracking-wider">Events</span>
        <div className="text-xs text-zinc-500 italic pl-1 mt-0.5">No events found</div>
      </div>
    </div>
  );
};
