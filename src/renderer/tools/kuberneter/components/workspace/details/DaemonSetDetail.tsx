import type React from 'react';
import { type DaemonSetData } from '../../../types/DaemonSetData';

interface DaemonSetDetailProps {
  payload: DaemonSetData;
  isTab?: boolean;
}

export const DaemonSetDetail: React.FC<DaemonSetDetailProps> = ({ payload, isTab = false }) => {
  if (!payload) {
    return <div className="p-4 text-xs text-zinc-500">No daemon set details available.</div>;
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
          <span className="text-[10px] text-zinc-555 uppercase">Node Selector</span>
          <span className="font-mono text-zinc-350 bg-editor-bg px-2 py-1.5 rounded border border-border-dark/60 break-all select-text selection:bg-accent/30 selection:text-white leading-relaxed">
            {payload.nodeSelector || 'N/A'}
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] text-zinc-555 uppercase">Scheduling Details</span>
          <span className="font-mono text-zinc-300">
            Desired: {payload.desired} | Current: {payload.current} | Ready: {payload.ready}
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] text-zinc-555 uppercase">Up-to-Date / Available</span>
          <span className="font-mono text-zinc-300">
            Up-to-Date: {payload.upToDate} | Available: {payload.available}
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
            <span className="text-emerald-500 font-bold">45s ago</span>
            <span>Created pod for DaemonSet nodes</span>
          </div>
          <div className="flex gap-1">
            <span className="text-emerald-500 font-bold">40s ago</span>
            <span>Successful scheduling on active nodes</span>
          </div>
        </div>
      </div>
    </div>
  );
};
