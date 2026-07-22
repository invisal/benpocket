import type React from 'react';
import { Filter } from 'lucide-react';
import { KubeTable } from '../../../kubeTable';
import { type PodVolume } from './types';

interface PodVolumesSectionProps {
  volumes: PodVolume[];
}

export const PodVolumesSection: React.FC<PodVolumesSectionProps> = ({ volumes }) => {
  const volumeColumns = [
    {
      key: 'name',
      header: 'Name',
      className: 'font-mono text-zinc-300 font-semibold',
      render: (row: PodVolume) => row.name
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
      render: (row: PodVolume) => (row.sourcesCount !== undefined ? String(row.sourcesCount) : '3')
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
        <div className="text-xs text-zinc-500 italic pl-1">No volumes found</div>
      ) : (
        <div className="border-y border-border/40 flex flex-col max-h-[160px] h-auto w-full overflow-y-auto">
          <KubeTable<PodVolume>
            columns={volumeColumns}
            data={volumes}
            getRowKey={(row) => row.name}
            resizable={false}
          />
        </div>
      )}
    </div>
  );
};
