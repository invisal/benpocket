import type React from 'react';
import { type PriorityClassData } from '../../../types/PriorityClassData';
import { KubePropertiesTable, type PropertyItem } from './KubePropertiesTable';

interface PriorityClassDetailProps {
  payload: PriorityClassData;
  isTab?: boolean;
}

export const PriorityClassDetail: React.FC<PriorityClassDetailProps> = ({
  payload,
  isTab = false
}) => {
  if (!payload) {
    return <div className="p-4 text-xs text-zinc-500">No PriorityClass details available.</div>;
  }

  const labels = payload.labels ? Object.entries(payload.labels) : [];
  const annotations = payload.annotations ? Object.entries(payload.annotations) : [];

  const propertiesData: PropertyItem[] = [
    {
      id: 'created',
      name: 'Created',
      value: `${payload.age} ago (${payload.createdTime || 'N/A'})`
    },
    {
      id: 'name',
      name: 'Name',
      value: payload.name
    },
    {
      id: 'labels',
      name: 'Labels',
      value: `${labels.length} Labels`,
      hasDetail: labels.length > 0,
      renderDetail: () => (
        <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto pr-1 select-text">
          {labels.map(([k, v]) => (
            <span
              key={k}
              className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-surface-3 border border-border/60 text-zinc-350 truncate max-w-full"
              title={`${k}=${v}`}
            >
              {k}={v}
            </span>
          ))}
        </div>
      )
    },
    {
      id: 'annotations',
      name: 'Annotations',
      value: `${annotations.length} Annotations`,
      hasDetail: annotations.length > 0,
      renderDetail: () => (
        <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto pr-1 select-text">
          {annotations.map(([k, v]) => (
            <span
              key={k}
              className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-surface-3 border border-border/60 text-zinc-350 truncate max-w-full"
              title={`${k}=${v}`}
            >
              {k}={v}
            </span>
          ))}
        </div>
      )
    }
  ];

  if (payload.description) {
    propertiesData.push({
      id: 'description',
      name: 'Description',
      value: payload.description
    });
  }

  propertiesData.push(
    {
      id: 'value',
      name: 'Value',
      value: payload.value
    },
    {
      id: 'globalDefault',
      name: 'Global Default',
      value: payload.globalDefault ? 'true' : 'false'
    }
  );

  return (
    <div className={`flex flex-col gap-4 ${isTab ? 'p-6 h-full overflow-y-auto' : 'flex-1'}`}>
      {/* Properties Section */}
      <div className="flex flex-col gap-2.5 mt-1">
        <span className="text-[10px] font-bold text-zinc-450 uppercase tracking-wider mb-1">
          Properties
        </span>
        <KubePropertiesTable properties={propertiesData} />
      </div>

      {/* Events Section */}
      <div className="flex flex-col gap-1.5 mt-2 border-t border-border-dark/60 pt-3">
        <span className="text-[10px] font-bold text-zinc-455 uppercase tracking-wider">Events</span>
        <div className="text-xs text-zinc-500 italic pl-1 mt-0.5">No events found</div>
      </div>
    </div>
  );
};
