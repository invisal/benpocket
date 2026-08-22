import { Age } from '../../Age';
import type React from 'react';
import { type PersistentVolumeClaimData } from '../../../types/PersistentVolumeClaimData';
import { useLayoutStore } from '../../../../../src/store/layout.store';
import { useKuberneterStore } from '../../../store/kuberneter.store';
import { KubePropertiesTable, type PropertyItem } from './KubePropertiesTable';

import { useOpenNamespaceDetail } from '../../../hooks/open-detail';

interface PersistentVolumeClaimDetailProps {
  payload: PersistentVolumeClaimData;
  isTab?: boolean;
}

export const PersistentVolumeClaimDetail: React.FC<PersistentVolumeClaimDetailProps> = ({
  payload,
  isTab = false
}) => {
  const activeInstanceId = useLayoutStore((s) => s.activeInstanceId);
  const openTab = useLayoutStore((s) => s.openTab);
  const setNamespace = useKuberneterStore((s) => s.setKuberneterInstanceNamespace);
  const setKuberneterInstanceResource = useKuberneterStore((s) => s.setKuberneterInstanceResource);
  const { openNamespaceDetail } = useOpenNamespaceDetail();

  if (!payload) {
    return (
      <div className="p-4 text-sm text-zinc-500">No Persistent Volume Claim details available.</div>
    );
  }

  const handleNamespaceClick = () => {
    if (payload.ns) {
      openNamespaceDetail(payload.ns);
    }
  };

  const handlePodClick = (podName: string) => {
    console.debug('Navigate to pod:', podName);
    if (activeInstanceId) {
      setNamespace(activeInstanceId, payload.ns);
      setKuberneterInstanceResource(activeInstanceId, 'pods');
      openTab({
        id: `kuberneter-k8s-pods-${activeInstanceId}`,
        title: `K8s Pods`,
        type: 'kuberneter',
        instanceId: activeInstanceId,
        meta: { resource: 'pods' }
      });
    }
  };

  const annotations = payload.annotations ? Object.entries(payload.annotations) : [];
  const labels = payload.labels ? Object.entries(payload.labels) : [];
  const finalizers = payload.finalizers || [];
  const pods = payload.pods || [];
  const matchLabels = payload.selector?.matchLabels
    ? Object.entries(payload.selector.matchLabels)
    : [];
  const matchExpressions = payload.selector?.matchExpressions || [];

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
    }
  ];

  if (finalizers.length > 0) {
    propertiesData.push({
      id: 'finalizers',
      name: 'Finalizers',
      value: `${finalizers.length} Finalizers`,
      hasDetail: true,
      renderDetail: () => (
        <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto pr-1 select-text">
          {finalizers.map((f) => (
            <span
              key={f}
              className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-surface-3 border border-border/60 text-zinc-350 truncate max-w-full"
              title={f}
            >
              {f}
            </span>
          ))}
        </div>
      )
    });
  }

  propertiesData.push(
    {
      id: 'accessModes',
      name: 'Access Modes',
      value: payload.accessModes.join(', ') || '—'
    },
    {
      id: 'storageClassName',
      name: 'Storage Class Name',
      value: (
        <span className="font-mono text-accent hover:underline cursor-pointer">
          {payload.storageClass}
        </span>
      )
    },
    {
      id: 'storage',
      name: 'Storage',
      value: payload.capacity
    },
    {
      id: 'pods',
      name: 'Pods',
      value:
        pods.length === 0 ? (
          '—'
        ) : pods.length === 1 ? (
          <span
            onClick={() => handlePodClick(pods[0])}
            className="font-mono text-accent hover:underline cursor-pointer"
          >
            {pods[0]}
          </span>
        ) : (
          `${pods.length} Pods`
        ),
      hasDetail: pods.length > 1,
      renderDetail: () => (
        <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto pr-1 select-text">
          {pods.map((podName) => (
            <span
              key={podName}
              onClick={() => handlePodClick(podName)}
              className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-surface-3 border border-border/60 text-accent hover:underline cursor-pointer mr-1"
            >
              {podName}
            </span>
          ))}
        </div>
      )
    },
    {
      id: 'status',
      name: 'Status',
      value: (
        <span
          className={`font-semibold ${
            payload.status === 'Bound' ? 'text-emerald-500' : 'text-amber-500'
          }`}
        >
          {payload.status}
        </span>
      )
    }
  );

  const selectorProperties: PropertyItem[] = [
    {
      id: 'matchLabels',
      name: 'Match Labels',
      value: matchLabels.length > 0 ? `${matchLabels.length} Labels` : '—',
      hasDetail: matchLabels.length > 0,
      renderDetail: () => (
        <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto pr-1 select-text">
          {matchLabels.map(([k, v]) => (
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
      id: 'matchExpressions',
      name: 'Match Expressions',
      value: matchExpressions.length > 0 ? `${matchExpressions.length} Expressions` : '—',
      hasDetail: matchExpressions.length > 0,
      renderDetail: () => (
        <div className="flex flex-col gap-1 max-h-32 overflow-y-auto pr-1 select-text">
          {matchExpressions.map((exp, idx) => (
            <span
              key={idx}
              className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-surface-3 border border-border/60 text-zinc-350"
            >
              {exp.key} {exp.operator} {exp.values?.join(', ')}
            </span>
          ))}
        </div>
      )
    }
  ];

  return (
    <div className={`flex flex-col gap-4 ${isTab ? 'p-6 h-full overflow-y-auto' : 'flex-1'}`}>
      {/* Metrics Section */}
      <div className="flex flex-col gap-2 bg-surface-2/40 border border-border/40 rounded-lg p-3">
        <div className="flex justify-between items-center text-[10px] font-bold text-zinc-450 uppercase tracking-wider">
          <span>Metrics</span>
          <span className="text-zinc-500 font-normal">1h</span>
        </div>
        <div className="h-32 w-full bg-black/10 rounded border border-border-dark/30 relative flex flex-col justify-end p-2 select-none">
          {/* Y Axis labels */}
          <div className="absolute left-2 top-2 bottom-6 flex flex-col justify-between text-[8px] font-mono text-zinc-500 select-none">
            <span>1.000</span>
            <span>0.800</span>
            <span>0.600</span>
            <span>0.400</span>
            <span>0.200</span>
            <span>0</span>
          </div>
          {/* Grid lines & Chart Area */}
          <div className="ml-10 flex-1 relative border-b border-l border-zinc-700/40">
            {/* Horizontal Grid lines */}
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-20">
              <div className="border-t border-dashed border-zinc-500 h-0 w-full" />
              <div className="border-t border-dashed border-zinc-500 h-0 w-full" />
              <div className="border-t border-dashed border-zinc-500 h-0 w-full" />
              <div className="border-t border-dashed border-zinc-500 h-0 w-full" />
              <div className="border-t border-dashed border-zinc-500 h-0 w-full" />
            </div>
            {/* Flat metric line at 0 */}
            <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
              <line x1="0" y1="100%" x2="100%" y2="100%" stroke="#10b981" strokeWidth="1.5" />
            </svg>
          </div>
          {/* Timeline X Axis */}
          <div className="ml-10 mt-1.5 flex justify-between text-[8px] font-mono text-zinc-500 select-none">
            <span>10:51</span>
            <span>10:57</span>
            <span>11:03</span>
            <span>11:09</span>
            <span>11:15</span>
            <span>11:21</span>
            <span>11:27</span>
            <span>11:33</span>
            <span>11:39</span>
            <span>11:45</span>
          </div>
        </div>
      </div>

      {/* Properties Section */}
      <div className="flex flex-col gap-2.5">
        <span className="text-[10px] font-bold text-zinc-450 uppercase tracking-wider mb-1">
          Properties
        </span>
        <KubePropertiesTable properties={propertiesData} />
      </div>

      {/* Selector Section */}
      <div className="flex flex-col gap-2.5 mt-2 border-t border-border-dark/60 pt-3">
        <span className="text-[10px] font-bold text-zinc-450 uppercase tracking-wider mb-1">
          Selector
        </span>
        <KubePropertiesTable properties={selectorProperties} />
      </div>

      {/* Events Section */}
      <div className="flex flex-col gap-1.5 mt-2 border-t border-border-dark/60 pt-3">
        <span className="text-[10px] font-bold text-zinc-450 uppercase tracking-wider">Events</span>
        <div className="text-sm text-zinc-500 italic pl-1 mt-0.5">No events found</div>
      </div>
    </div>
  );
};
