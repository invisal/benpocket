import type React from 'react';
import { Filter } from 'lucide-react';
import { KubeTable } from '../../../kubeTable';
import { type PodToleration } from './types';

interface PodTolerationsSectionProps {
  tolerations: PodToleration[];
}

export const PodTolerationsSection: React.FC<PodTolerationsSectionProps> = ({ tolerations }) => {
  const tolerationColumns = [
    {
      key: 'key',
      header: 'Key',
      className: 'font-mono text-zinc-300',
      render: (row: PodToleration) => row.key || '—'
    },
    {
      key: 'operator',
      header: 'Operator',
      className: 'font-mono text-zinc-400',
      render: (row: PodToleration) => row.operator || '—'
    },
    {
      key: 'value',
      header: 'Value',
      className: 'font-mono text-zinc-400',
      render: (row: PodToleration) => row.value || '—'
    },
    {
      key: 'effect',
      header: 'Effect',
      className: 'font-mono text-zinc-400',
      render: (row: PodToleration) => row.effect || '—'
    },
    {
      key: 'tolerationSeconds',
      header: 'Seconds',
      className: 'font-mono text-zinc-500',
      render: (row: PodToleration) =>
        row.tolerationSeconds !== undefined ? `${row.tolerationSeconds}` : '—'
    }
  ];

  return (
    <div className="flex flex-col gap-1.5 border-t border-border-dark/60 pt-3">
      <div className="flex items-center gap-1.5 text-[10px] font-bold text-zinc-455 uppercase tracking-wider mb-1">
        <span>Tolerations</span>
        <Filter className="size-3 text-zinc-500" />
      </div>
      {tolerations.length === 0 ? (
        <div className="text-xs text-zinc-500 italic pl-1">No tolerations found</div>
      ) : (
        <div className="border-y border-border/40 flex flex-col max-h-[160px] h-auto w-full overflow-y-auto">
          <KubeTable<PodToleration>
            columns={tolerationColumns}
            data={tolerations}
            getRowKey={(row) =>
              `${row.key || ''}-${row.operator || ''}-${row.effect || ''}-${row.tolerationSeconds || ''}`
            }
            resizable={false}
          />
        </div>
      )}
    </div>
  );
};
