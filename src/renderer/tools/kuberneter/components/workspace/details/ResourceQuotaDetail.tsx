import { Age } from '../../Age';
import type React from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { type ResourceQuotaData, type QuotaItem } from '../../../types/ResourceQuotaData';
import { KubePropertiesTable, type PropertyItem } from './KubePropertiesTable';
import { useOpenNamespaceDetail } from '../../../hooks/open-detail';
import { useLayoutStore } from '../../../../../src/store/layout.store';
import { useKuberneterStore } from '../../../store/kuberneter.store';
import { K8S_RESOURCE_KEYS } from '../../../constants/k8sResources';
import { type K8sResource } from '../../../types/K8sResource';

interface ResourceQuotaDetailProps {
  payload: ResourceQuotaData;
  isTab?: boolean;
}

interface ResourceQuotaRawResource {
  metadata?: {
    name?: string;
    namespace?: string;
    creationTimestamp?: string;
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
  };
  spec?: {
    hard?: Record<string, string>;
    scopes?: string[];
    scopeSelector?: {
      matchExpressions?: Array<{ operator: string; scopeName: string; values?: string[] }>;
    };
  };
  status?: {
    hard?: Record<string, string>;
    used?: Record<string, string>;
  };
}

function parseK8sQuantity(val: string): number {
  if (!val) return 0;
  const v = val.trim();
  if (v.endsWith('m')) return parseFloat(v.slice(0, -1)) / 1000;
  if (v.endsWith('Ki')) return parseFloat(v.slice(0, -2)) * 1024;
  if (v.endsWith('Mi')) return parseFloat(v.slice(0, -2)) * 1024 * 1024;
  if (v.endsWith('Gi')) return parseFloat(v.slice(0, -2)) * 1024 * 1024 * 1024;
  if (v.endsWith('Ti')) return parseFloat(v.slice(0, -2)) * 1024 * 1024 * 1024 * 1024;
  if (v.endsWith('k')) return parseFloat(v.slice(0, -1)) * 1000;
  if (v.endsWith('M')) return parseFloat(v.slice(0, -1)) * 1000 * 1000;
  if (v.endsWith('G')) return parseFloat(v.slice(0, -1)) * 1000 * 1000 * 1000;
  return parseFloat(v) || 0;
}

export const ResourceQuotaDetail: React.FC<ResourceQuotaDetailProps> = ({
  payload,
  isTab = false
}) => {
  const activeInstanceId = useLayoutStore((s) => s.activeInstanceId);
  const cluster = useKuberneterStore((s) => s.kuberneterInstanceCluster[activeInstanceId] || '');
  const rawConfigPath = useKuberneterStore(
    (s) => s.kuberneterInstanceConfigPath[activeInstanceId] || 'default'
  );

  const { openNamespaceDetail } = useOpenNamespaceDetail();

  // Fetch fresh ResourceQuota with React Query caching
  const { data: queryData } = useQuery({
    queryKey: [
      'kuberneter',
      'resourcequota-detail-data',
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
        K8S_RESOURCE_KEYS.RESOURCE_QUOTAS,
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
    return <div className="p-4 text-xs text-zinc-500">No resource quota details available.</div>;
  }

  const rawItem = (queryData || payload.rawItem) as unknown as ResourceQuotaRawResource | undefined;

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

  const specHard = rawItem?.spec?.hard || {};
  const statusHard = rawItem?.status?.hard || {};
  const statusUsed = rawItem?.status?.used || {};

  const resourceKeys = Array.from(
    new Set([
      ...Object.keys(specHard),
      ...Object.keys(statusHard),
      ...(payload.quotas || []).map((q) => q.resourceName)
    ])
  );

  const quotas: QuotaItem[] = resourceKeys.map((key) => {
    const hardVal =
      statusHard[key] ||
      specHard[key] ||
      payload.quotas?.find((q) => q.resourceName === key)?.hard ||
      '0';
    const usedVal =
      statusUsed[key] || payload.quotas?.find((q) => q.resourceName === key)?.used || '0';
    return {
      resourceName: key,
      used: usedVal,
      hard: hardVal
    };
  });

  const scopes = rawItem?.spec?.scopes || payload.scopes || [];

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

  if (scopes.length > 0) {
    propertiesData.push({
      id: 'scopes',
      name: 'Scopes',
      value: (
        <div className="flex flex-wrap gap-1">
          {scopes.map((s) => (
            <span
              key={s}
              className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-surface-3 border border-border/60 text-zinc-300"
            >
              {s}
            </span>
          ))}
        </div>
      )
    });
  }

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
          Quotas ({quotas.length} rules)
        </span>
        {quotas.length > 0 ? (
          <div className="flex flex-col border-y border-border/40 bg-surface-2/30">
            <div className="flex items-center justify-between px-3 py-2 bg-surface-3/30 border-b border-border/30 text-[10px] font-bold text-zinc-500 uppercase font-mono">
              <span>Resource</span>
              <span>Used / Hard</span>
            </div>
            <div className="flex flex-col divide-y divide-border/20 max-h-72 overflow-y-auto pr-1">
              {quotas.map((q) => {
                const usedNum = parseK8sQuantity(q.used);
                const hardNum = parseK8sQuantity(q.hard);
                const pct = hardNum > 0 ? Math.min(100, Math.round((usedNum / hardNum) * 100)) : 0;
                const barColor =
                  pct >= 90 ? 'bg-rose-500' : pct >= 70 ? 'bg-amber-500' : 'bg-emerald-500';

                return (
                  <div
                    key={q.resourceName}
                    className="flex flex-col gap-1 px-3 py-2.5 text-xs hover:bg-surface-3/20 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className="font-mono text-zinc-200 font-semibold truncate mr-4"
                        title={q.resourceName}
                      >
                        {q.resourceName}
                      </span>
                      <span className="font-mono text-zinc-300 shrink-0 text-xs">
                        <span className="text-foreground font-medium">{q.used}</span>{' '}
                        <span className="text-zinc-550 font-normal">/</span> {q.hard}{' '}
                        {hardNum > 0 && (
                          <span className="text-[10px] text-zinc-400 font-sans ml-1">({pct}%)</span>
                        )}
                      </span>
                    </div>
                    {hardNum > 0 && (
                      <div className="w-full h-1.5 bg-surface-4 rounded-full overflow-hidden mt-0.5">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${barColor}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <span className="text-xs text-zinc-500 italic px-1">No quota rules defined.</span>
        )}
      </div>

      {/* Events Section */}
      <div className="flex flex-col gap-1.5 mt-2 border-t border-border-dark/60 pt-3">
        <span className="text-[10px] font-bold text-zinc-450 uppercase tracking-wider">Events</span>
        <div className="text-xs text-zinc-500 italic pl-1 mt-0.5">No events found</div>
      </div>
    </div>
  );
};
