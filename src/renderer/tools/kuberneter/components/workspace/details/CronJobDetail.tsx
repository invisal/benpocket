import { Age } from '../../Age';
import type React from 'react';
import { type CronJobData } from '../../../types/CronJobData';
import { KubePropertiesTable, type PropertyItem } from './KubePropertiesTable';

interface CronJobDetailProps {
  payload: CronJobData;
  isTab?: boolean;
}

export const CronJobDetail: React.FC<CronJobDetailProps> = ({ payload, isTab = false }) => {
  if (!payload) {
    return <div className="p-4 text-xs text-zinc-500">No cron job details available.</div>;
  }

  const propertiesData: PropertyItem[] = [
    {
      id: 'name',
      name: 'Name',
      value: payload.name
    },
    {
      id: 'namespace',
      name: 'Namespace',
      value: payload.ns
    },
    {
      id: 'schedule',
      name: 'Schedule',
      value: payload.schedule
    },
    {
      id: 'suspend',
      name: 'Suspend',
      value: (
        <span
          className={
            payload.suspend ? 'text-amber-400 font-semibold' : 'text-emerald-400 font-semibold'
          }
        >
          {payload.suspend ? 'true' : 'false'}
        </span>
      )
    },
    {
      id: 'active',
      name: 'Active Jobs',
      value: payload.active
    },
    {
      id: 'lastSchedule',
      name: 'Last Schedule',
      value: payload.lastSchedule
    },
    {
      id: 'nextExecution',
      name: 'Next Execution',
      value: payload.nextExecution
    },
    {
      id: 'timeZone',
      name: 'Time Zone',
      value: payload.timeZone
    },
    {
      id: 'age',
      name: 'Age',
      value: (
        <span>
          <Age
            timestamp={(payload as unknown as Record<string, unknown>).creationTimestamp as string}
          />{' '}
          ago ({((payload as unknown as Record<string, unknown>).createdTime as string) || 'N/A'})
        </span>
      )
    }
  ];

  return (
    <div className={`flex flex-col gap-4 ${isTab ? 'p-6 h-full overflow-y-auto' : 'flex-1'}`}>
      <div className="flex flex-col gap-2.5 mt-1">
        <span className="text-[10px] font-bold text-zinc-450 uppercase tracking-wider mb-1">
          Properties
        </span>
        <KubePropertiesTable properties={propertiesData} />
      </div>
    </div>
  );
};
