import type React from 'react';
import { type CronJobData } from '../../../types/CronJobData';

interface CronJobDetailProps {
  payload: CronJobData;
  isTab?: boolean;
}

export const CronJobDetail: React.FC<CronJobDetailProps> = ({ payload, isTab = false }) => {
  if (!payload) {
    return <div className="p-4 text-xs text-zinc-500">No cron job details available.</div>;
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
          <span className="text-[10px] text-zinc-555 uppercase">Schedule</span>
          <span className="font-mono text-zinc-100 bg-surface-2 border border-border-dark/30 rounded px-2 py-1 mt-0.5">
            {payload.schedule}
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] text-zinc-555 uppercase">Status</span>
          <span className="font-mono text-zinc-300 border border-border-dark/30 rounded p-1.5 bg-surface-2 flex flex-col gap-1 mt-1">
            <div className="flex justify-between">
              <span className="text-zinc-400">Suspend:</span>
              <span className={payload.suspend ? 'text-amber-400' : 'text-emerald-400'}>
                {payload.suspend ? 'true' : 'false'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Active Jobs:</span>
              <span>{payload.active}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Last Schedule:</span>
              <span>{payload.lastSchedule}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Next Execution:</span>
              <span>{payload.nextExecution}</span>
            </div>
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] text-zinc-555 uppercase">Time Zone / Age</span>
          <span className="font-mono text-zinc-300">
            {payload.timeZone} ({payload.age})
          </span>
        </div>
      </div>
    </div>
  );
};
