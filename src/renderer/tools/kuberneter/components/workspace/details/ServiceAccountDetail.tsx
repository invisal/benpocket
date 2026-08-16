import { Age } from '../../Age';
import type React from 'react';
import { type ServiceAccountData } from '../../../types/ServiceAccountData';
import { KubePropertiesTable, type PropertyItem } from './KubePropertiesTable';

import { useOpenNamespaceDetail } from '../../../hooks/open-detail';

interface ServiceAccountDetailProps {
  payload: ServiceAccountData;
  isTab?: boolean;
}

export const ServiceAccountDetail: React.FC<ServiceAccountDetailProps> = ({
  payload,
  isTab = false
}) => {
  const { openNamespaceDetail } = useOpenNamespaceDetail();

  if (!payload) {
    return <div className="p-4 text-xs text-zinc-500">No Service Account details available.</div>;
  }

  const handleNamespaceClick = () => {
    if (payload.ns) {
      openNamespaceDetail(payload.ns);
    }
  };

  const labels = payload.labels ? Object.entries(payload.labels) : [];
  const annotations = payload.annotations ? Object.entries(payload.annotations) : [];
  const secrets = payload.secrets || [];
  const imagePullSecrets = payload.imagePullSecrets || [];

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
      id: 'namespace',
      name: 'Namespace',
      value: (
        <span
          onClick={handleNamespaceClick}
          className="font-mono text-accent hover:underline cursor-pointer"
        >
          {payload.ns}
        </span>
      )
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
    },
    {
      id: 'secrets',
      name: 'Secrets',
      value: `${secrets.length} Secret(s)`,
      hasDetail: secrets.length > 0,
      renderDetail: () => (
        <ul className="list-disc list-inside space-y-1 text-zinc-400 pr-1 select-text">
          {secrets.map((s) => (
            <li key={s} className="truncate font-mono text-[11px]" title={s}>
              {s}
            </li>
          ))}
        </ul>
      )
    },
    {
      id: 'imagePullSecrets',
      name: 'Image Pull Secrets',
      value: `${imagePullSecrets.length} Secret(s)`,
      hasDetail: imagePullSecrets.length > 0,
      renderDetail: () => (
        <ul className="list-disc list-inside space-y-1 text-zinc-400 pr-1 select-text">
          {imagePullSecrets.map((s) => (
            <li key={s} className="truncate font-mono text-[11px]" title={s}>
              {s}
            </li>
          ))}
        </ul>
      )
    }
  ];

  return (
    <div className={`flex flex-col gap-4 ${isTab ? 'p-6 h-full overflow-y-auto' : 'flex-1'}`}>
      <div className="flex flex-col gap-2.5 mt-1">
        <span className="text-[10px] font-bold text-zinc-455 uppercase tracking-wider mb-1">
          Properties
        </span>
        <KubePropertiesTable properties={propertiesData} />
      </div>

      {/* Events Section */}
      <div className="flex flex-col gap-1.5 mt-2 border-t border-border-dark/60 pt-3">
        <span className="text-[10px] font-bold text-zinc-450 uppercase tracking-wider">Events</span>
        <div className="text-xs text-zinc-500 italic pl-1 mt-0.5">No events found</div>
      </div>
    </div>
  );
};
