import type React from 'react';
import { type JobData } from '../../../types/JobData';

interface JobDetailProps {
  payload: JobData;
  isTab?: boolean;
}

export const JobDetail: React.FC<JobDetailProps> = ({ payload, isTab = false }) => {
  if (!payload) {
    return <div className="p-4 text-xs text-zinc-500">No job details available.</div>;
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
          <span className="text-[10px] text-zinc-555 uppercase">Completions</span>
          <span className="font-mono text-zinc-100 border border-border-dark/30 rounded p-1.5 bg-surface-2 flex flex-col gap-1 mt-1">
            <div className="flex justify-between">
              <span className="text-zinc-400">Desired:</span>
              <span>{payload.desired}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Succeeded:</span>
              <span className="text-emerald-400">{payload.succeeded}</span>
            </div>
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] text-zinc-555 uppercase">Conditions</span>
          <span className="font-mono text-zinc-300">{payload.conditions}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] text-zinc-555 uppercase">Age</span>
          <span className="font-mono text-zinc-300">{payload.age}</span>
        </div>
      </div>
    </div>
  );
};
