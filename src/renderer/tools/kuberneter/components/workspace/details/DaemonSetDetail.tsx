import { Age } from '../../Age';
import type React from 'react';
import { type DaemonSetData } from '../../../types/DaemonSetData';
import { KubePropertiesTable, type PropertyItem } from './KubePropertiesTable';

interface DaemonSetDetailProps {
  payload: DaemonSetData;
  isTab?: boolean;
}

export const DaemonSetDetail: React.FC<DaemonSetDetailProps> = ({ payload, isTab = false }) => {
  if (!payload) {
    return <div className="p-4 text-xs text-zinc-500">No daemon set details available.</div>;
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
      id: 'nodeSelector',
      name: 'Node Selector',
      value: payload.nodeSelector || 'N/A'
    },
    {
      id: 'scheduling',
      name: 'Scheduling Details',
      value: `Desired: ${payload.desired} | Current: ${payload.current} | Ready: ${payload.ready}`
    },
    {
      id: 'available',
      name: 'Up-to-Date / Available',
      value: `Up-to-Date: ${payload.upToDate} | Available: ${payload.available}`
    },
    {
      id: 'status',
      name: 'Status / Age',
      value: (
        <span>
          {payload.hasWarning ? 'Warning' : 'OK'} (
          <Age
            timestamp={(payload as unknown as Record<string, unknown>).creationTimestamp as string}
          />
          )
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
