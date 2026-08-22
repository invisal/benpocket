import { Age } from '../../Age';
import type React from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { type LeaseData } from '../../../types/LeaseData';
import { KubePropertiesTable, type PropertyItem } from './KubePropertiesTable';
import { useOpenNamespaceDetail, useOpenNodeDetail } from '../../../hooks/open-detail';
import { useLayoutStore } from '../../../../../src/store/layout.store';
import { useKuberneterStore } from '../../../store/kuberneter.store';
import { K8S_RESOURCE_KEYS } from '../../../constants/k8sResources';
import { type K8sResource } from '../../../types/K8sResource';

interface LeaseDetailProps {
  payload: LeaseData;
  isTab?: boolean;
}

interface LeaseRawResource {
  metadata?: {
    name?: string;
    namespace?: string;
    creationTimestamp?: string;
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
  };
  spec?: {
    holderIdentity?: string;
    leaseDurationSeconds?: number;
    renewTime?: string;
    acquireTime?: string;
    leaseTransitions?: number;
  };
}

export const LeaseDetail: React.FC<LeaseDetailProps> = ({ payload, isTab = false }) => {
  const activeInstanceId = useLayoutStore((s) => s.activeInstanceId);
  const cluster = useKuberneterStore((s) => s.kuberneterInstanceCluster[activeInstanceId] || '');
  const rawConfigPath = useKuberneterStore(
    (s) => s.kuberneterInstanceConfigPath[activeInstanceId] || 'default'
  );

  const { openNamespaceDetail } = useOpenNamespaceDetail();
  const { openNodeDetail } = useOpenNodeDetail();

  // Fetch fresh Lease with React Query caching
  const { data: queryData } = useQuery({
    queryKey: [
      'kuberneter',
      'lease-detail-data',
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
        K8S_RESOURCE_KEYS.LEASES,
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
    return <div className="p-4 text-xs text-zinc-500">No Lease details available.</div>;
  }

  const rawItem = (queryData || payload.rawItem) as unknown as LeaseRawResource | undefined;

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

  const holder = rawItem?.spec?.holderIdentity || payload.holder || '—';
  const durationSeconds = rawItem?.spec?.leaseDurationSeconds ?? payload.durationSeconds ?? 0;
  const renewTimeRaw = rawItem?.spec?.renewTime;
  const renewTime = renewTimeRaw
    ? new Date(renewTimeRaw).toLocaleString()
    : payload.renewTime || '—';

  const acquireTimeRaw = rawItem?.spec?.acquireTime;
  const acquireTime = acquireTimeRaw
    ? new Date(acquireTimeRaw).toLocaleString()
    : payload.acquireTime;

  const transitions = rawItem?.spec?.leaseTransitions ?? payload.transitions;

  // Check if holder looks like a node (e.g. in kube-node-lease or matches name)
  const isNodeLease = payload.ns === 'kube-node-lease' || holder === payload.name;

  const handleHolderClick = () => {
    if (holder && holder !== '—') {
      openNodeDetail(holder);
    }
  };

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
      id: 'holder',
      name: 'Holder Identity',
      value:
        isNodeLease && holder !== '—' ? (
          <span
            onClick={handleHolderClick}
            className="font-mono text-accent hover:underline cursor-pointer"
            title={`Open Node ${holder} in new tab`}
          >
            {holder}
          </span>
        ) : (
          <span className="font-mono text-zinc-300">{holder}</span>
        )
    },
    {
      id: 'durationSeconds',
      name: 'Lease Duration Seconds',
      value: <span className="font-mono">{durationSeconds}s</span>
    },
    {
      id: 'renewTime',
      name: 'Renew Time',
      value: <span className="font-mono">{renewTime}</span>
    }
  ];

  if (acquireTime) {
    propertiesData.push({
      id: 'acquireTime',
      name: 'Acquire Time',
      value: <span className="font-mono">{acquireTime}</span>
    });
  }

  if (transitions !== undefined) {
    propertiesData.push({
      id: 'transitions',
      name: 'Transitions',
      value: <span className="font-mono">{transitions}</span>
    });
  }

  propertiesData.push(
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
  );

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
