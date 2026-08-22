import { Age } from '../../Age';
import type React from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { type LimitRangeData, type LimitRangeItem } from '../../../types/LimitRangeData';
import { KubePropertiesTable, type PropertyItem } from './KubePropertiesTable';
import { useOpenNamespaceDetail } from '../../../hooks/open-detail';
import { useLayoutStore } from '../../../../../src/store/layout.store';
import { useKuberneterStore } from '../../../store/kuberneter.store';
import { K8S_RESOURCE_KEYS } from '../../../constants/k8sResources';
import { type K8sResource } from '../../../types/K8sResource';

interface LimitRangeDetailProps {
  payload: LimitRangeData;
  isTab?: boolean;
}

interface LimitRangeRawResource {
  metadata?: {
    name?: string;
    namespace?: string;
    creationTimestamp?: string;
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
  };
  spec?: {
    limits?: Array<{
      type: string;
      default?: Record<string, string>;
      defaultRequest?: Record<string, string>;
      max?: Record<string, string>;
      min?: Record<string, string>;
      maxLimitRequestRatio?: Record<string, string>;
    }>;
  };
}

export const LimitRangeDetail: React.FC<LimitRangeDetailProps> = ({ payload, isTab = false }) => {
  const activeInstanceId = useLayoutStore((s) => s.activeInstanceId);
  const cluster = useKuberneterStore((s) => s.kuberneterInstanceCluster[activeInstanceId] || '');
  const rawConfigPath = useKuberneterStore(
    (s) => s.kuberneterInstanceConfigPath[activeInstanceId] || 'default'
  );

  const { openNamespaceDetail } = useOpenNamespaceDetail();

  // Fetch fresh LimitRange with React Query caching
  const { data: queryData } = useQuery({
    queryKey: [
      'kuberneter',
      'limitrange-detail-data',
      rawConfigPath,
      cluster,
      payload?.ns,
      payload?.name
    ],
    queryFn: async () => {
      if (!cluster || !payload?.ns || !payload?.name) return null;
      const configPathArg = rawConfigPath === 'default' ? undefined : rawConfigPath;

      const res = await window.kuberneter.getResources(
        configPathArg,
        cluster,
        K8S_RESOURCE_KEYS.LIMIT_RANGES,
        payload.ns
      );
      const item = ((res?.items || []) as K8sResource[]).find(
        (i) => i.metadata?.name === payload.name
      );
      return item || null;
    },
    enabled: !!cluster && !!payload?.ns && !!payload?.name,
    placeholderData: keepPreviousData,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000
  });

  if (!payload) {
    return <div className="p-4 text-xs text-zinc-500">No limit range details available.</div>;
  }

  const rawItem = (queryData || payload.rawItem) as unknown as LimitRangeRawResource | undefined;

  const handleNamespaceClick = () => {
    if (payload.ns) {
      openNamespaceDetail(payload.ns);
    }
  };

  const labels = rawItem?.metadata?.labels
    ? Object.entries(rawItem.metadata.labels)
    : payload.labels
      ? Object.entries(payload.labels)
      : [];
  const annotations = rawItem?.metadata?.annotations
    ? Object.entries(rawItem.metadata.annotations)
    : payload.annotations
      ? Object.entries(payload.annotations)
      : [];

  const createdTime = rawItem?.metadata?.creationTimestamp
    ? new Date(rawItem.metadata.creationTimestamp).toLocaleString()
    : payload.createdTime || '';

  // Parse limits from rawItem or payload
  let limitsList: LimitRangeItem[] = payload.limits || [];
  if (rawItem?.spec?.limits) {
    const parsedLimits: LimitRangeItem[] = [];
    rawItem.spec.limits.forEach((limit) => {
      const limitType = limit.type || '';
      const resourceKeys = Array.from(
        new Set([
          ...Object.keys(limit.min || {}),
          ...Object.keys(limit.max || {}),
          ...Object.keys(limit.default || {}),
          ...Object.keys(limit.defaultRequest || {}),
          ...Object.keys(limit.maxLimitRequestRatio || {})
        ])
      );

      resourceKeys.forEach((resKey) => {
        parsedLimits.push({
          type: limitType,
          resource: resKey,
          min: limit.min?.[resKey],
          max: limit.max?.[resKey],
          defaultLimit: limit.default?.[resKey],
          defaultRequest: limit.defaultRequest?.[resKey],
          maxLimitRequestRatio: limit.maxLimitRequestRatio?.[resKey]
        });
      });
    });
    if (parsedLimits.length > 0) {
      limitsList = parsedLimits;
    }
  }

  // Group limits by type (e.g. Container, Pod, PersistentVolumeClaim)
  const limitsByType = limitsList.reduce(
    (acc, item) => {
      const type = item.type || 'Other';
      if (!acc[type]) acc[type] = [];
      acc[type].push(item);
      return acc;
    },
    {} as Record<string, typeof limitsList>
  );

  const propertiesData: PropertyItem[] = [
    {
      id: 'created',
      name: 'Created',
      value: (
        <span>
          <Age
            timestamp={
              rawItem?.metadata?.creationTimestamp ||
              ((payload as unknown as Record<string, unknown>).creationTimestamp as string)
            }
          />{' '}
          ago ({createdTime || 'N/A'})
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

      {/* Dynamic Limits Sections */}
      {Object.entries(limitsByType).map(([type, items]) => {
        const resourceOrder = ['cpu', 'memory', 'ephemeral-storage', 'storage'];
        const resourcesMap = items.reduce(
          (acc, item) => {
            acc[item.resource.toLowerCase()] = item;
            return acc;
          },
          {} as Record<string, (typeof items)[0]>
        );

        const allResources = Array.from(
          new Set([...resourceOrder.filter((r) => !!resourcesMap[r]), ...Object.keys(resourcesMap)])
        );

        return (
          <div
            key={type}
            className="flex flex-col gap-1.5 mt-2 border-t border-border-dark/60 pt-3"
          >
            <span className="text-[10px] font-bold text-zinc-450 uppercase tracking-wider mb-1.5 font-sans">
              {type} Limits
            </span>
            <div className="flex flex-col border-y border-border/40 divide-y divide-border/20 bg-surface-2/30">
              {allResources.map((resKey) => {
                const item = resourcesMap[resKey];
                const displayName =
                  resKey === 'cpu'
                    ? 'CPU'
                    : resKey === 'memory'
                      ? 'Memory'
                      : resKey === 'ephemeral-storage'
                        ? 'Ephemeral Storage'
                        : resKey === 'storage'
                          ? 'Storage'
                          : resKey;

                const badges: string[] = [];
                if (item) {
                  if (item.min) badges.push(`min: ${item.min}`);
                  if (item.max) badges.push(`max: ${item.max}`);
                  if (item.defaultLimit) badges.push(`default: ${item.defaultLimit}`);
                  if (item.defaultRequest) badges.push(`defaultRequest: ${item.defaultRequest}`);
                  if (item.maxLimitRequestRatio) badges.push(`ratio: ${item.maxLimitRequestRatio}`);
                }

                return (
                  <div
                    key={resKey}
                    className="flex items-center justify-between px-3 py-2.5 text-xs hover:bg-surface-3/20 transition-colors"
                  >
                    <span className="font-mono text-zinc-200 font-semibold">{displayName}</span>
                    {badges.length > 0 ? (
                      <div className="flex flex-wrap gap-1 justify-end">
                        {badges.map((b) => (
                          <span
                            key={b}
                            className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-surface-3 border border-border/60 text-zinc-300 select-all"
                          >
                            {b}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-zinc-555 font-mono">—</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Events Section */}
      <div className="flex flex-col gap-1.5 mt-2 border-t border-border-dark/60 pt-3">
        <span className="text-[10px] font-bold text-zinc-450 uppercase tracking-wider">Events</span>
        <div className="text-xs text-zinc-500 italic pl-1 mt-0.5">No events found</div>
      </div>
    </div>
  );
};
