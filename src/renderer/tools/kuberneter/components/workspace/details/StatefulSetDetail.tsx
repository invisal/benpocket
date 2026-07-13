import type React from 'react';
import { type StatefulSetData } from '../../../types/StatefulSetData';

interface StatefulSetDetailProps {
  payload: StatefulSetData;
  isTab?: boolean;
}

export const StatefulSetDetail: React.FC<StatefulSetDetailProps> = ({ payload, isTab = false }) => {
  if (!payload) {
    return <div className="p-4 text-xs text-zinc-500">No stateful set details available.</div>;
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
          <span className="text-[10px] text-zinc-555 uppercase">Pods / Replicas</span>
          <span className="font-mono text-zinc-300">
            Pods Status: {payload.ready} (Total Replicas: {payload.replicas})
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] text-zinc-555 uppercase">Warning State / Age</span>
          <span className="font-mono text-zinc-300">
            {payload.hasWarning ? 'Warning' : 'OK'} ({payload.age})
          </span>
        </div>
      </div>

      {/* Event Logs Drawer Mockup */}
      <div className="flex flex-col gap-1.5 mt-2 border-t border-border-dark/60 pt-3">
        <span className="text-[10px] font-bold text-zinc-455 uppercase">EVENT HISTORY</span>
        <div className="flex flex-col gap-1.5 font-mono text-[10px] text-zinc-500">
          <div className="flex gap-1">
            <span className="text-emerald-500 font-bold">1m ago</span>
            <span>StatefulSet replicas scale check successful</span>
          </div>
          <div className="flex gap-1">
            <span className="text-emerald-500 font-bold">50s ago</span>
            <span>Active volume mount mapping confirmed</span>
          </div>
        </div>
      </div>
    </div>
  );
};
