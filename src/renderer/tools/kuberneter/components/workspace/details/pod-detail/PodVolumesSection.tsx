import type React from 'react';
import { Filter } from 'lucide-react';
import { KubeTable } from '../../../kubeTable';
import type { Column } from '../../../kubeTable';
import { type PodVolume } from './types';
import { useOpenConfigDetail, useOpenStorageDetail } from '../../../../hooks/open-detail';

interface PodVolumesSectionProps {
  volumes: PodVolume[];
  namespace?: string;
}

export const PodVolumesSection: React.FC<PodVolumesSectionProps> = ({ volumes, namespace }) => {
  const { openConfigMapDetail, openSecretDetail } = useOpenConfigDetail();
  const { openPvcDetail } = useOpenStorageDetail();

  const volumeColumns: Column<PodVolume>[] = [
    {
      key: 'name',
      header: 'Name',
      className: 'font-mono text-zinc-300',
      render: (row: PodVolume) => {
        if (row.configMap?.name) {
          return (
            <span
              onClick={(e) => {
                e.stopPropagation();
                openConfigMapDetail(namespace || '', row.configMap!.name);
              }}
              className="text-accent hover:underline cursor-pointer font-mono"
              title={`ConfigMap: ${row.configMap.name}`}
            >
              {row.name}
            </span>
          );
        }
        if (row.secret?.secretName) {
          return (
            <span
              onClick={(e) => {
                e.stopPropagation();
                openSecretDetail(namespace || '', row.secret!.secretName);
              }}
              className="text-accent hover:underline cursor-pointer font-mono"
              title={`Secret: ${row.secret.secretName}`}
            >
              {row.name}
            </span>
          );
        }
        if (row.persistentVolumeClaim?.claimName) {
          return (
            <span
              onClick={(e) => {
                e.stopPropagation();
                openPvcDetail(namespace || '', row.persistentVolumeClaim!.claimName);
              }}
              className="text-accent hover:underline cursor-pointer font-mono"
              title={`PVC: ${row.persistentVolumeClaim.claimName}`}
            >
              {row.name}
            </span>
          );
        }
        return <span className="font-mono text-zinc-300 font-semibold">{row.name}</span>;
      }
    },
    {
      key: 'defaultMode',
      header: 'Default Mode',
      className: 'font-mono text-zinc-400',
      render: (row: PodVolume) => row.defaultMode || '0o644'
    },
    {
      key: 'sources',
      header: 'Sources',
      className: 'font-mono text-zinc-400',
      render: (row: PodVolume) => {
        if (row.configMap?.name) return `ConfigMap: ${row.configMap.name}`;
        if (row.secret?.secretName) return `Secret: ${row.secret.secretName}`;
        if (row.persistentVolumeClaim?.claimName)
          return `PVC: ${row.persistentVolumeClaim.claimName}`;
        if (row.emptyDir) return 'emptyDir';
        if (row.hostPath) return `hostPath: ${row.hostPath.path}`;
        return row.sourcesCount !== undefined ? String(row.sourcesCount) : '—';
      }
    }
  ];

  return (
    <div className="flex flex-col gap-1.5 border-t border-border-dark/60 pt-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold text-zinc-450 uppercase tracking-wider">
          Pod Volumes
        </span>
      </div>
      <div className="flex items-center gap-1 text-[10px] text-zinc-400 font-semibold mt-1">
        <span>Projected</span>
        <Filter className="size-3 text-zinc-500" />
      </div>
      {volumes.length === 0 ? (
        <div className="text-sm text-zinc-500 italic pl-1">No volumes found</div>
      ) : (
        <div className="border-y border-border/40 flex flex-col max-h-[160px] h-auto w-full overflow-y-auto">
          <KubeTable<PodVolume>
            columns={volumeColumns}
            data={volumes}
            getRowKey={(row) => row.name}
            onRowClick={(row) => {
              if (row.configMap?.name) {
                openConfigMapDetail(namespace || '', row.configMap.name);
              } else if (row.secret?.secretName) {
                openSecretDetail(namespace || '', row.secret.secretName);
              } else if (row.persistentVolumeClaim?.claimName) {
                openPvcDetail(namespace || '', row.persistentVolumeClaim.claimName);
              }
            }}
            resizable={false}
          />
        </div>
      )}
    </div>
  );
};
