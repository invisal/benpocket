import { Age } from '../../Age';
import type React from 'react';
import { type StorageClassData, type StorageClassPVInfo } from '../../../types/StorageClassData';
import { useLayoutStore } from '../../../../../src/store/layout.store';
import { useKuberneterStore } from '../../../store/kuberneter.store';
import { KubeTable } from '../../kubeTable';
import { KubePropertiesTable, type PropertyItem } from './KubePropertiesTable';

interface StorageClassDetailProps {
  payload: StorageClassData;
  isTab?: boolean;
}

export const StorageClassDetail: React.FC<StorageClassDetailProps> = ({
  payload,
  isTab = false
}) => {
  const activeInstanceId = useLayoutStore((s) => s.activeInstanceId);
  const openTab = useLayoutStore((s) => s.openTab);
  const setKuberneterInstanceResource = useKuberneterStore((s) => s.setKuberneterInstanceResource);

  if (!payload) {
    return <div className="p-4 text-xs text-zinc-500">No Storage Class details available.</div>;
  }

  const handlePvClick = (pvName: string) => {
    console.debug('Navigate to PV:', pvName);
    if (activeInstanceId) {
      setKuberneterInstanceResource(activeInstanceId, 'pvs');
      openTab({
        id: `kuberneter-k8s-pvs-${activeInstanceId}`,
        title: `K8s Persistent Volumes`,
        type: 'kuberneter',
        instanceId: activeInstanceId,
        meta: { resource: 'pvs' }
      });
    }
  };

  const annotations = payload.annotations ? Object.entries(payload.annotations) : [];
  const labels = payload.labels ? Object.entries(payload.labels) : [];

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
    },
    {
      id: 'provisioner',
      name: 'Provisioner',
      value: <span className="font-mono text-zinc-300">{payload.provisioner}</span>
    },
    {
      id: 'volumeBindingMode',
      name: 'Volume Binding Mode',
      value: payload.volumeBindingMode
    },
    {
      id: 'reclaimPolicy',
      name: 'Reclaim Policy',
      value: payload.reclaimPolicy
    }
  ];

  return (
    <div className={`flex flex-col gap-4 ${isTab ? 'p-6 h-full overflow-y-auto' : 'flex-1'}`}>
      {/* Properties Section */}
      <div className="flex flex-col gap-2.5">
        <span className="text-[10px] font-bold text-zinc-450 uppercase tracking-wider mb-1">
          Properties
        </span>
        <KubePropertiesTable properties={propertiesData} />
      </div>

      {/* Persistent Volumes List */}
      <div className="flex flex-col gap-1.5 mt-2 border-t border-border-dark/60 pt-3">
        <span className="text-[10px] font-bold text-zinc-450 uppercase tracking-wider mb-1">
          Persistent Volumes
        </span>
        {payload.pvs.length === 0 ? (
          <div className="text-xs text-zinc-500 italic pl-1">No persistent volumes found</div>
        ) : (
          <div className="border-y border-border/40 flex flex-col h-auto max-h-[220px]">
            <KubeTable<StorageClassPVInfo>
              columns={[
                {
                  key: 'name',
                  header: 'Name',
                  className:
                    'font-mono text-accent hover:underline cursor-pointer truncate max-w-[240px]',
                  render: (row) => (
                    <span onClick={() => handlePvClick(row.name)} title={row.name}>
                      {row.name}
                    </span>
                  )
                },
                {
                  key: 'capacity',
                  header: 'Capacity',
                  className: 'font-mono text-zinc-450'
                },
                {
                  key: 'status',
                  header: 'Status',
                  className: 'font-semibold',
                  render: (row) => (
                    <span
                      className={
                        row.status === 'Bound' || row.status === 'Available'
                          ? 'text-emerald-500'
                          : 'text-red-500'
                      }
                    >
                      {row.status}
                    </span>
                  )
                }
              ]}
              data={payload.pvs}
              getRowKey={(row) => row.name}
              resizable={false}
            />
          </div>
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
