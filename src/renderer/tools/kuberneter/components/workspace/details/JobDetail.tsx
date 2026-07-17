import type React from 'react';
import { type JobData } from '../../../types/JobData';
import { KubePropertiesTable, type PropertyItem } from './KubePropertiesTable';

interface JobDetailProps {
  payload: JobData;
  isTab?: boolean;
}

export const JobDetail: React.FC<JobDetailProps> = ({ payload, isTab = false }) => {
  if (!payload) {
    return <div className="p-4 text-xs text-zinc-500">No job details available.</div>;
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
      id: 'completions',
      name: 'Completions',
      value: `Succeeded: ${payload.succeeded} / Desired: ${payload.desired}`
    },
    {
      id: 'conditions',
      name: 'Conditions',
      value: payload.conditions
    },
    {
      id: 'age',
      name: 'Age',
      value: payload.age
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
