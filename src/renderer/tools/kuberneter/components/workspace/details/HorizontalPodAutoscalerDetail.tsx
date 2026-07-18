import { Age } from '../../Age';
import type React from 'react';
import { type HorizontalPodAutoscalerData } from '../../../types/HorizontalPodAutoscalerData';
import { useLayoutStore } from '../../../../../src/store/layout.store';
import { useKuberneterStore } from '../../../store/kuberneter.store';
import { KubePropertiesTable, type PropertyItem } from './KubePropertiesTable';

interface HorizontalPodAutoscalerDetailProps {
  payload: HorizontalPodAutoscalerData;
  isTab?: boolean;
}

export const HorizontalPodAutoscalerDetail: React.FC<HorizontalPodAutoscalerDetailProps> = ({
  payload,
  isTab = false
}) => {
  const activeInstanceId = useLayoutStore((s) => s.activeInstanceId);
  const setNamespace = useKuberneterStore((s) => s.setKuberneterInstanceNamespace);
  const setResource = useKuberneterStore((s) => s.setKuberneterInstanceResource);

  if (!payload) {
    return <div className="p-4 text-xs text-zinc-500">No HPA details available.</div>;
  }

  const handleNamespaceClick = () => {
    if (payload.ns && activeInstanceId) {
      setNamespace(activeInstanceId, payload.ns);
    }
  };

  const handleReferenceClick = () => {
    if (payload.referenceKind && activeInstanceId) {
      const lowerKind = payload.referenceKind.toLowerCase();
      let resourceId = '';
      if (lowerKind === 'deployment') resourceId = 'deployments';
      else if (lowerKind === 'statefulset') resourceId = 'statefulsets';
      else if (lowerKind === 'replicaset') resourceId = 'replicasets';

      if (resourceId) {
        setResource(activeInstanceId, resourceId);
      }
    }
  };

  const labels = payload.labels ? Object.entries(payload.labels) : [];
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
      id: 'reference',
      name: 'Reference',
      value: (
        <span
          onClick={handleReferenceClick}
          className="font-mono text-accent hover:underline cursor-pointer"
        >
          {payload.referenceKind}/{payload.referenceName}
        </span>
      )
    },
    {
      id: 'minPods',
      name: 'Min Pods',
      value: payload.minPods
    },
    {
      id: 'maxPods',
      name: 'Max Pods',
      value: payload.maxPods
    },
    {
      id: 'replicas',
      name: 'Replicas',
      value: payload.replicas
    },
    {
      id: 'status',
      name: 'Status',
      value: payload.statusText || '—'
    }
  ];

  return (
    <div className={`flex flex-col gap-4 ${isTab ? 'p-6 h-full overflow-y-auto' : 'flex-1'}`}>
      {/* Properties Section */}
      <div className="flex flex-col gap-2.5 mt-1">
        <span className="text-[10px] font-bold text-zinc-455 uppercase tracking-wider mb-1">
          Properties
        </span>
        <KubePropertiesTable properties={propertiesData} />
      </div>

      {/* Metrics Section */}
      <div className="flex flex-col gap-1.5 mt-2 border-t border-border-dark/60 pt-3">
        <span className="text-[10px] font-bold text-zinc-450 uppercase tracking-wider mb-1.5 font-sans">
          Metrics
        </span>
        {payload.metrics && payload.metrics.length > 0 ? (
          <div className="flex flex-col border-y border-border/40 bg-surface-2/30">
            <div className="flex items-center justify-between px-3 py-2 bg-surface-3/30 border-b border-border/30 text-[10px] font-bold text-zinc-500 uppercase font-mono">
              <span>Name</span>
              <span>Current / Target</span>
            </div>
            <div className="flex flex-col divide-y divide-border/20 max-h-48 overflow-y-auto">
              {payload.metrics.map((m) => (
                <div key={m.name} className="flex items-center justify-between px-3 py-2 text-xs">
                  <span className="font-sans text-zinc-300 truncate mr-4" title={m.name}>
                    {m.name}
                  </span>
                  <span className="font-mono text-zinc-300 font-semibold shrink-0">
                    {m.current} <span className="text-zinc-555 font-normal">/</span> {m.target}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <span className="text-xs text-zinc-500 italic px-1">No metrics configured.</span>
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
