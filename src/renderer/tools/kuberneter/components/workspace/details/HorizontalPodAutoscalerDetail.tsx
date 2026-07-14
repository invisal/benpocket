import type React from 'react';
import { type HorizontalPodAutoscalerData } from '../../../types/HorizontalPodAutoscalerData';
import { useLayoutStore } from '../../../../../src/store/layout.store';
import { useKuberneterStore } from '../../../store/kuberneter.store';

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

  return (
    <div className={`flex flex-col gap-4 ${isTab ? 'p-6 h-full overflow-y-auto' : 'flex-1'}`}>
      {/* Properties Section */}
      <div className="flex flex-col gap-2.5 mt-1">
        <span className="text-[10px] font-bold text-zinc-450 uppercase tracking-wider mb-1">
          Properties
        </span>
        <div className="flex flex-col gap-2.5 text-xs text-zinc-350 bg-surface-2/40 border border-border/40 rounded-lg p-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] text-zinc-555 uppercase">Created</span>
            <span className="font-mono text-zinc-300">
              {payload.age} ago ({payload.createdTime || 'N/A'})
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] text-zinc-555 uppercase">Name</span>
            <span className="font-mono text-zinc-200 break-all">{payload.name}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] text-zinc-555 uppercase">Namespace</span>
            <span
              onClick={handleNamespaceClick}
              className="font-mono text-accent hover:underline cursor-pointer self-start"
            >
              {payload.ns}
            </span>
          </div>
          {annotations.length > 0 && (
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] text-zinc-555 uppercase">Annotations</span>
              <div className="flex flex-col gap-1 max-h-24 overflow-y-auto mt-0.5 pr-1 select-text">
                {annotations.map(([k, v]) => (
                  <div
                    key={k}
                    className="font-mono text-[10px] text-zinc-400 bg-editor-bg px-2 py-1 rounded border border-border-dark/60 truncate"
                    title={`${k}=${v}`}
                  >
                    {k}={v}
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="flex flex-col gap-0.5 border-t border-border/20 pt-2">
            <span className="text-[10px] text-zinc-555 uppercase">Reference</span>
            <span
              onClick={handleReferenceClick}
              className="font-mono text-accent hover:underline cursor-pointer self-start"
            >
              {payload.referenceKind}/{payload.referenceName}
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] text-zinc-555 uppercase">Min Pods</span>
            <span className="font-mono text-zinc-300">{payload.minPods}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] text-zinc-555 uppercase">Max Pods</span>
            <span className="font-mono text-zinc-300">{payload.maxPods}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] text-zinc-555 uppercase">Replicas</span>
            <span className="font-mono text-zinc-300">{payload.replicas}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] text-zinc-555 uppercase">Status</span>
            <span className="font-mono text-zinc-300">{payload.statusText || '—'}</span>
          </div>
        </div>
      </div>

      {/* Metrics Section */}
      <div className="flex flex-col gap-1.5 mt-2 border-t border-border-dark/60 pt-3">
        <span className="text-[10px] font-bold text-zinc-450 uppercase tracking-wider mb-1.5 font-sans">
          Metrics
        </span>
        {payload.metrics && payload.metrics.length > 0 ? (
          <div className="flex flex-col border border-border/40 rounded-lg bg-surface-2/30 overflow-hidden">
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
                    {m.current} <span className="text-zinc-550 font-normal">/</span> {m.target}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <span className="text-xs text-zinc-500 italic px-1">No metrics configured.</span>
        )}
      </div>

      {/* Labels */}
      {labels.length > 0 && (
        <div className="flex flex-col gap-1.5 border-t border-border-dark/60 pt-3">
          <span className="text-[10px] font-bold text-zinc-455 uppercase tracking-wider">
            Labels
          </span>
          <div className="flex flex-wrap gap-1">
            {labels.map(([k, v]) => (
              <span
                key={k}
                className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-surface-2 border border-border text-zinc-300 break-all"
              >
                {k}: {v}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Events Mockup Section */}
      <div className="flex flex-col gap-1.5 mt-2 border-t border-border-dark/60 pt-3">
        <span className="text-[10px] font-bold text-zinc-450 uppercase tracking-wider">Events</span>
        <div className="text-xs text-zinc-500 italic pl-1 mt-0.5">No events found</div>
      </div>
    </div>
  );
};
