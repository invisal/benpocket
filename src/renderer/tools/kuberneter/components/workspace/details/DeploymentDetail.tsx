import type React from 'react';
import { type DeployData } from '../../../types/DeployData';

interface DeploymentDetailProps {
  payload: DeployData;
  isTab?: boolean;
}

export const DeploymentDetail: React.FC<DeploymentDetailProps> = ({ payload, isTab = false }) => {
  if (!payload) {
    return <div className="p-4 text-xs text-zinc-500">No deployment details available.</div>;
  }

  return (
    <div className={`flex flex-col gap-4 ${isTab ? 'p-6 h-full overflow-y-auto' : 'flex-1'}`}>
      <div className="flex flex-col gap-2.5 text-xs text-zinc-350">
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] text-zinc-550 uppercase">Resource Name</span>
          <span className="font-mono text-zinc-200 break-all">{payload.name}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] text-zinc-550 uppercase">Namespace</span>
          <span className="font-mono text-zinc-300">{payload.ns}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] text-zinc-555 uppercase">Strategy Type</span>
          <span className="font-mono text-zinc-300">{payload.strategy}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] text-zinc-555 uppercase">Replicas Details</span>
          <span className="font-mono text-zinc-300">
            Pods: {payload.ready} (Available: {payload.available}, Up-to-Date: {payload.upToDate})
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] text-zinc-555 uppercase">Status / Age</span>
          <span className="font-mono text-zinc-300">
            {payload.status} ({payload.age})
          </span>
        </div>
      </div>

      {/* Event Logs Drawer Mockup */}
      <div className="flex flex-col gap-1.5 mt-2 border-t border-border-dark/60 pt-3">
        <span className="text-[10px] font-bold text-zinc-455 uppercase">EVENT HISTORY</span>
        <div className="flex flex-col gap-1.5 font-mono text-[10px] text-zinc-500">
          <div className="flex gap-1">
            <span className="text-emerald-500 font-bold">45s ago</span>
            <span>Deployment scaled to {payload.replicas}</span>
          </div>
          <div className="flex gap-1">
            <span className="text-emerald-500 font-bold">40s ago</span>
            <span>Created replica set for generation 1</span>
          </div>
          <div className="flex gap-1">
            <span className="text-emerald-500 font-bold">35s ago</span>
            <span>Scaled up replica set to {payload.replicas}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
