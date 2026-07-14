import type React from 'react';
import { type LimitRangeData } from '../../../types/LimitRangeData';
import { useLayoutStore } from '../../../../../src/store/layout.store';
import { useKuberneterStore } from '../../../store/kuberneter.store';

interface LimitRangeDetailProps {
  payload: LimitRangeData;
  isTab?: boolean;
}

export const LimitRangeDetail: React.FC<LimitRangeDetailProps> = ({ payload, isTab = false }) => {
  const activeInstanceId = useLayoutStore((s) => s.activeInstanceId);
  const setNamespace = useKuberneterStore((s) => s.setKuberneterInstanceNamespace);

  if (!payload) {
    return <div className="p-4 text-xs text-zinc-500">No limit range details available.</div>;
  }

  const handleNamespaceClick = () => {
    if (payload.ns && activeInstanceId) {
      setNamespace(activeInstanceId, payload.ns);
    }
  };

  const labels = payload.labels ? Object.entries(payload.labels) : [];
  const annotations = payload.annotations ? Object.entries(payload.annotations) : [];

  // Group limits by type (e.g. Container, Pod)
  const limitsByType = (payload.limits || []).reduce(
    (acc, item) => {
      const type = item.type || 'Other';
      if (!acc[type]) acc[type] = [];
      acc[type].push(item);
      return acc;
    },
    {} as Record<string, typeof payload.limits>
  );

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
        </div>
      </div>

      {/* Dynamic Limits Sections */}
      {Object.entries(limitsByType).map(([type, items]) => {
        // Group items in this type by resource name (e.g. cpu, memory)
        // Standard resource names to display in order: cpu, memory, ephemeral-storage
        const resourceOrder = ['cpu', 'memory', 'ephemeral-storage'];
        const resourcesMap = items.reduce(
          (acc, item) => {
            acc[item.resource.toLowerCase()] = item;
            return acc;
          },
          {} as Record<string, (typeof items)[0]>
        );

        // Include any other resources defined
        const allResources = Array.from(new Set([...resourceOrder, ...Object.keys(resourcesMap)]));

        return (
          <div
            key={type}
            className="flex flex-col gap-1.5 mt-2 border-t border-border-dark/60 pt-3"
          >
            <span className="text-[10px] font-bold text-zinc-450 uppercase tracking-wider mb-1.5">
              {type} Limits
            </span>
            <div className="flex flex-col border border-border/40 rounded-lg bg-surface-2/30 overflow-hidden divide-y divide-border/20">
              {allResources.map((resKey) => {
                const item = resourcesMap[resKey];
                const displayName =
                  resKey === 'cpu'
                    ? 'CPU'
                    : resKey === 'memory'
                      ? 'Memory'
                      : resKey === 'ephemeral-storage'
                        ? 'Ephemeral Storage'
                        : resKey;

                const badges: string[] = [];
                if (item) {
                  if (item.min) badges.push(`min:${item.min}`);
                  if (item.max) badges.push(`max:${item.max}`);
                  if (item.defaultLimit) badges.push(`default:${item.defaultLimit}`);
                  if (item.defaultRequest) badges.push(`defaultRequest:${item.defaultRequest}`);
                  if (item.maxLimitRequestRatio) badges.push(`ratio:${item.maxLimitRequestRatio}`);
                }

                return (
                  <div
                    key={resKey}
                    className="flex items-center justify-between px-3 py-2.5 text-xs"
                  >
                    <span className="font-sans text-zinc-400 capitalize">{displayName}</span>
                    {badges.length > 0 ? (
                      <div className="flex flex-wrap gap-1 justify-end">
                        {badges.map((b) => (
                          <span
                            key={b}
                            className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-surface-3 border border-border text-zinc-300 select-all"
                          >
                            {b}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-zinc-550 font-mono">—</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

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
