import { Age } from '../../Age';
import type React from 'react';
import { type PersistentVolumeData } from '../../../types/PersistentVolumeData';
import { useLayoutStore } from '../../../../../src/store/layout.store';
import { useKuberneterStore } from '../../../store/kuberneter.store';
import { KubePropertiesTable, type PropertyItem } from './KubePropertiesTable';

interface PersistentVolumeDetailProps {
  payload: PersistentVolumeData;
  isTab?: boolean;
}

export const PersistentVolumeDetail: React.FC<PersistentVolumeDetailProps> = ({
  payload,
  isTab = false
}) => {
  const activeInstanceId = useLayoutStore((s) => s.activeInstanceId);
  const openTab = useLayoutStore((s) => s.openTab);
  const setNamespace = useKuberneterStore((s) => s.setKuberneterInstanceNamespace);
  const setKuberneterInstanceResource = useKuberneterStore((s) => s.setKuberneterInstanceResource);

  if (!payload) {
    return <div className="p-4 text-sm text-zinc-500">No Persistent Volume details available.</div>;
  }

  const handleClaimClick = (claimName: string, ns: string) => {
    console.debug('Navigate to claim:', claimName);
    if (activeInstanceId) {
      setNamespace(activeInstanceId, ns);
      setKuberneterInstanceResource(activeInstanceId, 'pvcs');
      openTab({
        id: `kuberneter-k8s-pvcs-${activeInstanceId}`,
        title: `K8s Persistent Volume Claims`,
        type: 'kuberneter',
        instanceId: activeInstanceId,
        meta: { resource: 'pvcs' }
      });
    }
  };

  const annotations = payload.annotations ? Object.entries(payload.annotations) : [];
  const labels = payload.labels ? Object.entries(payload.labels) : [];
  const finalizers = payload.finalizers || [];

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
      id: 'capacity',
      name: 'Capacity',
      value: payload.capacity
    },
    {
      id: 'accessModes',
      name: 'Access Modes',
      value: payload.accessModes.join(', ') || '—'
    },
    {
      id: 'reclaimPolicy',
      name: 'Reclaim Policy',
      value: payload.reclaimPolicy
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
      id: 'status',
      name: 'Status',
      value: (
        <span
          className={`font-semibold ${
            payload.status === 'Bound' || payload.status === 'Available'
              ? 'text-emerald-500'
              : 'text-red-500'
          }`}
        >
          {payload.status}
        </span>
      )
    },
    {
      id: 'volumeMode',
      name: 'Volume Mode',
      value: payload.volumeMode
    }
  );

  const providerProperties: PropertyItem[] = payload.provider
    ? [
        {
          id: 'sourceProvider',
          name: 'Source Provider',
          value: payload.provider.type
        }
      ]
    : [];

  if (payload.provider) {
    if (payload.provider.driver) {
      providerProperties.push({
        id: 'driver',
        name: 'Driver',
        value: payload.provider.driver
      });
    }
    if (payload.provider.path) {
      providerProperties.push({
        id: 'path',
        name: 'Path',
        value: payload.provider.path
      });
    }

    const volumeAttrs = payload.provider.volumeAttributes
      ? Object.entries(payload.provider.volumeAttributes)
      : [];
    if (volumeAttrs.length > 0) {
      volumeAttrs.forEach(([k, v]) => {
        providerProperties.push({
          id: `attr-${k}`,
          name: k,
          value: v
        });
      });
    }

    if (payload.provider.fsType) {
      providerProperties.push({
        id: 'fsType',
        name: 'FS Type',
        value: payload.provider.fsType
      });
    }
    if (payload.provider.readOnly !== undefined) {
      providerProperties.push({
        id: 'readOnly',
        name: 'Read Only',
        value: String(payload.provider.readOnly)
      });
    }
  }

  const claimProperties: PropertyItem[] = payload.claim
    ? [
        {
          id: 'claimType',
          name: 'Type',
          value: payload.claim.kind
        },
        {
          id: 'claimName',
          name: 'Name',
          value: (
            <span
              onClick={() => handleClaimClick(payload.claim!.name, payload.claim!.namespace)}
              className="font-mono text-accent hover:underline cursor-pointer"
            >
              {payload.claim.name}
            </span>
          )
        },
        {
          id: 'claimNamespace',
          name: 'Namespace',
          value: payload.claim.namespace
        }
      ]
    : [];

  return (
    <div className={`flex flex-col gap-4 ${isTab ? 'p-6 h-full overflow-y-auto' : 'flex-1'}`}>
      {/* Properties Section */}
      <div className="flex flex-col gap-2.5">
        <span className="text-[10px] font-bold text-zinc-450 uppercase tracking-wider mb-1">
          Properties
        </span>
        <KubePropertiesTable properties={propertiesData} />
      </div>

      {/* Provider Section */}
      {providerProperties.length > 0 && (
        <div className="flex flex-col gap-2.5 mt-2 border-t border-border-dark/60 pt-3">
          <span className="text-[10px] font-bold text-zinc-450 uppercase tracking-wider mb-1">
            Provider
          </span>
          <KubePropertiesTable properties={providerProperties} />
        </div>
      )}

      {/* Claim Section */}
      {claimProperties.length > 0 && (
        <div className="flex flex-col gap-2.5 mt-2 border-t border-border-dark/60 pt-3">
          <span className="text-[10px] font-bold text-zinc-450 uppercase tracking-wider mb-1">
            Claim
          </span>
          <KubePropertiesTable properties={claimProperties} />
        </div>
      )}

      {/* Events Section */}
      <div className="flex flex-col gap-1.5 mt-2 border-t border-border-dark/60 pt-3">
        <span className="text-[10px] font-bold text-zinc-450 uppercase tracking-wider">Events</span>
        <div className="text-sm text-zinc-500 italic pl-1 mt-0.5">No events found</div>
      </div>
    </div>
  );
};
