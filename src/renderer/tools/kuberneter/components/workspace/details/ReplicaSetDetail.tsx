import type React from 'react';
import { type ReplicaSetData } from '../../../types/ReplicaSetData';

interface ReplicaSetDetailProps {
  payload: ReplicaSetData;
  isTab?: boolean;
}

export const ReplicaSetDetail: React.FC<ReplicaSetDetailProps> = ({ payload, isTab = false }) => {
  if (!payload) {
    return <div className="p-4 text-xs text-zinc-500">No replica set details available.</div>;
  }

  return (
    <div className={`flex flex-col gap-4 ${isTab ? 'p-6 h-full overflow-y-auto' : 'flex-1'}`}>
      <div className="flex flex-col gap-2.5 text-xs text-zinc-350">
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] text-zinc-555 uppercase">Resource Name</span>
          <span className="font-mono text-zinc-200 break-all">{payload.name}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] text-zinc-555 uppercase">Namespace</span>
          <span className="font-mono text-zinc-300">{payload.ns}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] text-zinc-555 uppercase">Desired / Current / Ready</span>
          <span className="font-mono text-zinc-300 border border-border-dark/30 rounded p-1.5 bg-surface-2 flex flex-col gap-1 mt-1">
            <div className="flex justify-between">
              <span>Desired:</span>
              <span className="text-zinc-100">{payload.desired}</span>
            </div>
            <div className="flex justify-between">
              <span>Current:</span>
              <span className="text-zinc-100">{payload.current}</span>
            </div>
            <div className="flex justify-between">
              <span>Ready:</span>
              <span className="text-zinc-100">{payload.ready}</span>
            </div>
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] text-zinc-555 uppercase">Warning State / Age</span>
          <span className="font-mono text-zinc-300">
            {payload.hasWarning ? 'Warning (Replica mismatch)' : 'OK'} ({payload.age})
          </span>
        </div>
      </div>

      {/* Event Logs Drawer Mockup */}
      <div className="flex flex-col gap-1.5 mt-2 border-t border-border-dark/60 pt-3">
        <span className="text-[10px] font-bold text-zinc-455 uppercase">EVENT HISTORY</span>
        <div className="flex flex-col gap-1.5 font-mono text-[10px] text-zinc-500">
          <div className="flex gap-1">
            <span className="text-emerald-500 font-bold">2m ago</span>
            <span>ReplicaSet scale evaluation complete</span>
          </div>
          <div className="flex gap-1">
            <span className="text-emerald-500 font-bold">1m ago</span>
            <span>Replica counts matched expected state</span>
          </div>
        </div>
      </div>
    </div>
  );
};
