import { Age } from '../../Age';
import type React from 'react';
import { type IngressClassData } from '../../../types/IngressClassData';
import { KubePropertiesTable, type PropertyItem } from './KubePropertiesTable';

interface IngressClassDetailProps {
  payload: IngressClassData;
  isTab?: boolean;
}

export const IngressClassDetail: React.FC<IngressClassDetailProps> = ({
  payload,
  isTab = false
}) => {
  if (!payload) {
    return <div className="p-4 text-xs text-zinc-500">No IngressClass details available.</div>;
  }

  const annotations = payload.annotations ? Object.entries(payload.annotations) : [];

  const propertiesData: PropertyItem[] = [
    {
      id: 'created',
      name: 'Created',
      value: (
        <span>
          <Age
            timestamp={(payload as unknown as Record<string, unknown>).creationTimestamp as string}
          />{' '}
          ago ({((payload as unknown as Record<string, unknown>).createdTime as string) || 'N/A'})
        </span>
      )
    },
    {
      id: 'name',
      name: 'Name',
      value: payload.name
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
    },
    {
      id: 'controller',
      name: 'Controller',
      value: payload.controller || '—'
    }
  ];

  const parametersData: PropertyItem[] = [
    {
      id: 'parametersName',
      name: 'Name',
      value: payload.parametersName || '—'
    },
    {
      id: 'parametersScope',
      name: 'Scope',
      value: payload.parametersScope || '—'
    },
    {
      id: 'parametersKind',
      name: 'Kind',
      value: payload.parametersKind || '—'
    },
    {
      id: 'parametersApiGroup',
      name: 'API Group',
      value: payload.parametersApiGroup || '—'
    }
  ];

  return (
    <div className={`flex flex-col gap-4 ${isTab ? 'p-6 h-full overflow-y-auto' : 'flex-1'}`}>
      {/* Properties Section */}
      <div className="flex flex-col gap-2.5 mt-1">
        <span className="text-[10px] font-bold text-zinc-450 uppercase tracking-wider mb-1">
          Properties
        </span>
        <KubePropertiesTable properties={propertiesData} />
      </div>

      {/* Parameters Section */}
      <div className="flex flex-col gap-2.5 border-t border-border-dark/60 pt-3">
        <span className="text-[10px] font-bold text-zinc-450 uppercase tracking-wider mb-1">
          Parameters
        </span>
        <KubePropertiesTable properties={parametersData} />
      </div>

      {/* Events Section */}
      <div className="flex flex-col gap-1.5 border-t border-border-dark/60 pt-3">
        <span className="text-[10px] font-bold text-zinc-455 uppercase tracking-wider">Events</span>
        <div className="text-xs text-zinc-500 italic pl-1 mt-0.5">No events found</div>
      </div>
    </div>
  );
};
