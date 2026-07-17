import type React from 'react';
import { type ResourceQuotaData } from '../../../types/ResourceQuotaData';
import { useLayoutStore } from '../../../../../src/store/layout.store';
import { useKuberneterStore } from '../../../store/kuberneter.store';
import { KubePropertiesTable, type PropertyItem } from './KubePropertiesTable';

interface ResourceQuotaDetailProps {
  payload: ResourceQuotaData;
  isTab?: boolean;
}

export const ResourceQuotaDetail: React.FC<ResourceQuotaDetailProps> = ({
  payload,
  isTab = false
}) => {
  const activeInstanceId = useLayoutStore((s) => s.activeInstanceId);
  const setNamespace = useKuberneterStore((s) => s.setKuberneterInstanceNamespace);

  if (!payload) {
    return <div className="p-4 text-xs text-zinc-500">No resource quota details available.</div>;
  }

  const handleNamespaceClick = () => {
    if (payload.ns && activeInstanceId) {
      setNamespace(activeInstanceId, payload.ns);
    }
  };

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

      {/* Quotas Section */}
      <div className="flex flex-col gap-1.5 mt-2 border-t border-border-dark/60 pt-3">
        <span className="text-[10px] font-bold text-zinc-450 uppercase tracking-wider mb-1.5">
          Quotas
        </span>
        {payload.quotas && payload.quotas.length > 0 ? (
          <div className="flex flex-col border-y border-border/40 bg-surface-2/30">
            <div className="flex items-center justify-between px-3 py-2 bg-surface-3/30 border-b border-border/30 text-[10px] font-bold text-zinc-500 uppercase font-mono">
              <span>Resource</span>
              <span>Used / Hard</span>
            </div>
            <div className="flex flex-col divide-y divide-border/20 max-h-60 overflow-y-auto pr-1">
              {payload.quotas.map((q) => (
                <div
                  key={q.resourceName}
                  className="flex items-center justify-between px-3 py-2 text-xs"
                >
                  <span className="font-mono text-zinc-300 truncate mr-4" title={q.resourceName}>
                    {q.resourceName}
                  </span>
                  <span className="font-mono text-zinc-300 font-semibold shrink-0">
                    {q.used} <span className="text-zinc-550 font-normal">/</span> {q.hard}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <span className="text-xs text-zinc-500 italic px-1">No quota rules defined.</span>
        )}
      </div>

      {/* Events Mockup Section */}
      <div className="flex flex-col gap-1.5 mt-2 border-t border-border-dark/60 pt-3">
        <span className="text-[10px] font-bold text-zinc-450 uppercase tracking-wider">Events</span>
        <div className="text-xs text-zinc-500 italic pl-1 mt-0.5">No events found</div>
      </div>
    </div>
  );
};
