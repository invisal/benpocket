import type React from 'react';
import { type PodData } from '../../../types/PodData';

interface PodDetailProps {
  payload: PodData;
  isTab?: boolean;
}

export const PodDetail: React.FC<PodDetailProps> = ({ payload, isTab = false }) => {
  if (!payload) {
    return <div className="p-4 text-xs text-zinc-500">No pod details available.</div>;
  }

  return (
    <div className={`flex flex-col gap-4 ${isTab ? 'p-6 h-full overflow-y-auto' : 'flex-1'}`}>
      {/* Pod details content */}
      <div className="flex flex-col gap-2.5 text-xs text-zinc-355">
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] text-zinc-550 uppercase">Resource Name</span>
          <span className="font-mono text-zinc-200 break-all">{payload.name}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] text-zinc-550 uppercase">Namespace</span>
          <span className="font-mono text-zinc-350">{payload.ns}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] text-zinc-550 uppercase">Controlled By</span>
          <span className="font-mono text-zinc-350">{payload.controlledBy || '—'}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] text-zinc-555 uppercase">Node Name</span>
          <span className="font-mono text-zinc-350">{payload.node || '—'}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] text-zinc-555 uppercase">QoS Class</span>
          <span className="font-mono text-zinc-350">{payload.qos || '—'}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] text-zinc-555 uppercase">Status / Restarts</span>
          <span className="font-mono text-zinc-350">
            {payload.status} ({payload.restarts} restarts)
          </span>
        </div>
      </div>

      {/* Containers info section */}
      {payload.containers && payload.containers.length > 0 && (
        <div className="flex flex-col gap-2.5 border-t border-border-dark/60 pt-3.5">
          <span className="text-[10px] font-bold text-zinc-455 uppercase">Containers</span>
          <div className="flex flex-col gap-2">
            {payload.containers.map((c) => (
              <div key={c.name} className="flex items-center justify-between text-xs">
                <span className="font-mono text-zinc-300 truncate max-w-[180px]">{c.name}</span>
                <span
                  className={`text-[10px] font-bold uppercase ${
                    c.ready ? 'text-emerald-500' : 'text-rose-500'
                  }`}
                >
                  {c.ready ? 'Ready' : 'Not Ready'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      {/* Event Logs Drawer Mockup */}
      <div className="flex flex-col gap-1.5 mt-2 border-t border-border-dark/60 pt-3">
        <span className="text-[10px] font-bold text-zinc-455 uppercase">EVENT HISTORY</span>
        <div className="flex flex-col gap-1.5 font-mono text-[10px] text-zinc-500">
          <div className="flex gap-1">
            <span className="text-emerald-500 font-bold">12s ago</span>
            <span>Scheduled pod to {payload.node || 'minikube'}</span>
          </div>
          <div className="flex gap-1">
            <span className="text-emerald-500 font-bold">10s ago</span>
            <span>Successfully pulled container image</span>
          </div>
          <div className="flex gap-1">
            <span className="text-emerald-500 font-bold">8s ago</span>
            <span>Created and started container</span>
          </div>
        </div>
      </div>
    </div>
  );
};
